import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardMessageData } from "./dataTypes/message"
import StandardMessage from './message'
import { mergeTest } from './utils/testing'
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"

describe('StandardMessage class', () => {

    it('should construct StandardMessage from WML', () => {
        const testSource = deIndentWML(`
            <Message uuid=(001) key=(test)>
                <Room key=(testRoom) />
                <Description>Message Test</Description>
            </Message>
        `)
        const testMap = new StandardMessage(testSource)
        expect(testMap.universalKey).toEqual('MESSAGE#001')
        expect(testMap.key).toEqual('test')
        expect(testMap.description?.toJSON()).toEqual(['Message Test'])
        expect(testMap.rooms.toJSON()).toEqual([{ tag: 'Room', key: "testRoom" }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardMessage from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Message key=(test)>
                <Room key=(testRoom) />
                <Description>Message Test</Description>
            </Message>
        `)
        schema.loadWML(testSource)
        const testMap = new StandardMessage(schema.schema[0])
        expect(testMap.key).toEqual('test')
        expect(testMap.description?.toJSON()).toEqual(['Message Test'])
        expect(testMap.rooms.toJSON()).toEqual([{ tag: 'Room', key: "testRoom" }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardMessage from StandardMessageData', () => {
        const testMapData: StandardMessageData = {
            key: 'test',
            tag: 'Message',
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] },
            rooms: [{ tag: 'Room', key: "testRoom" }],
        }
        const testMap = new StandardMessage(testMapData)
        expect(testMap.key).toEqual('test')
        expect(testMap.description?.toJSON()).toEqual(['Message Test'])
        expect(testMap.rooms.toJSON()).toEqual([{ tag: 'Room', key: "testRoom" }])
        expect(testMap.toJSON()).toEqual(testMapData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Message key=(test)>
                <Description>Message test</Description>
                <Room key=(testRoom) />
            </Message>`,
            StandardMessage,
            `<Message key=(test)>
                <Description><Space />(extended)</Description>
                <Room key=(testRoomTwo) />
            </Message>`
        )).toEqual(deIndentWML(`
            <Message key=(test)>
                <Room key=(testRoom) />
                <Room key=(testRoomTwo) />
                <Description>Message test (extended)</Description>
            </Message>
        `))
    })

    it('should map contents on name', () => {
        const test = new StandardMessage(`
            <Message key=(test)>
                <Description>Message test.</Description>
                <Room key=(testRoom) />
            </Message>
        `)
        const callback = (tree) => {
            return tree.map((node) => {
                if (treeNodeTypeguard(isSchemaString)(node)) {
                    return { data: { tag: 'String', value: `${node.data.value}Narf!` }, children: [] }
                }
                else {
                    return {
                        ...node,
                        children: callback(node.children)
                    }
                }
            })
        }
        expect(schemaToWML([test.mapContents(callback).schema])).toEqual(deIndentWML(`
            <Message key=(test)>
                <Room key=(testRoom) />
                <Description>Message test.Narf!</Description>
            </Message>
        `))
    })

    it('should remap references', () => {
        const test = new StandardMessage(`
            <Message key=(test)>
                <Description>Message test.<Link to=(feature1) /></Description>
                <Room key=(testRoom) />
            </Message>
        `)
        const mappings = [new StandardReference({ key: 'feature1', tag: 'Feature', universalKey: 'FEATURE#feature1' }), new StandardReference({ key: 'testRoom', tag: 'Room', universalKey: 'ROOM#testRoom' })]
        const remapped = test.withMapping(mappings).remapReferences('universal')
        expect(schemaToWML([remapped.schema])).toEqual(deIndentWML(`
            <Message key=(test)>
                <Room key=(testRoom) />
                <Description>Message test.<Link to=(feature1) /></Description>
            </Message>
        `))
    })

    it('should correctly add a room reference to a message', () => {
        const test = new StandardMessage(`
            <Message key=(testMessage)>
                <Description>Message test.<Link to=(feature1) /></Description>
                <Room key=(testRoomOne) />
            </Message>
        `)
        const room = new StandardKey({ key: 'testRoomTwo' })
        const added = test.withChild(new StandardReference(room, 'Room'))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Message key=(testMessage)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo) />
                <Description>Message test.<Link to=(feature1) /></Description>
            </Message>
        `))
    })

    it('should construct StandardMessage from StandardMessageData with missing rooms', () => {
        const testMessageDataWithoutRooms: StandardMessageData = {
            key: 'test',
            tag: 'Message',
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] }
            // rooms property is missing - this should not crash
        }
        const testMessage = new StandardMessage(testMessageDataWithoutRooms)
        expect(testMessage.key).toEqual('test')
        expect(testMessage.description?.toJSON()).toEqual(['Message Test'])
        expect(testMessage.rooms.payload.length).toBe(0)  // Should default to empty array
        
        // The JSON output should omit rooms when empty (omission-over-empty pattern)
        const outputJSON = testMessage.toJSON() as StandardMessageData
        expect(outputJSON.rooms).toBeUndefined()
    })

    it('should throw on unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Message key=(test)>
                <Description>Message test.</Description>
                <Map key=(illegalMap) />
            </Message>
        `)
        expect(() => new StandardMessage(testSource)).toThrow(/Unconsumed child tags/)
        expect(() => new StandardMessage(testSource)).toThrow(/Map/)
    })

    describe('assureReferences method', () => {
        it('should return unchanged message when children array is empty', () => {
            const message = new StandardMessage({ tag: 'Message', key: 'test' })
            const { payload: result, inlineRemainder } = message._payload.assureReferences([])
            
            expect(result.rooms.payload.length).toBe(0)
            expect(inlineRemainder).toEqual([])
            // Verify it's a clone (original unchanged)
            expect(message._payload.rooms.payload.length).toBe(0)
        })
        
        it('should add children with ref={0} when they do not exist', () => {
            const message = new StandardMessage({ tag: 'Message', key: 'test' })
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const { payload: result } = message._payload.assureReferences([roomRef])
            
            // Verify reference was added with ref={0}
            expect(result.rooms.payload.length).toBe(1)
            expect(result.rooms.payload[0].ref).toBe(0)
            expect(result.rooms.payload[0].sameKey(roomRef)).toBe(true)
        })
        
        it('should leave existing references with non-zero ref unchanged', () => {
            const message = new StandardMessage(deIndentWML(`
                <Message key=(test)>
                    <Room key=(room1) />
                </Message>
            `))
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const { payload: result } = message._payload.assureReferences([roomRef])
            
            // Verify existing reference was left unchanged
            expect(result.rooms.payload.length).toBe(1)
            expect(result.rooms.payload[0].ref).toBe(1) // Original ref value (default)
        })
        
        it('should handle mixed scenarios (some exist, some do not)', () => {
            const message = new StandardMessage(deIndentWML(`
                <Message key=(test)>
                    <Room key=(existingRoom) />
                </Message>
            `))
            const existingRoom = new StandardReference({ tag: 'Room', key: 'existingRoom' })
            const newRoom = new StandardReference({ tag: 'Room', key: 'newRoom' })
            
            const { payload: result } = message._payload.assureReferences([existingRoom, newRoom])
            
            // Existing room should be unchanged
            expect(result.rooms.payload.length).toBe(2)
            const existingRoomInResult = result.rooms.payload.find(ref => ref.sameKey(existingRoom))
            expect(existingRoomInResult?.ref).toBe(1) // Original ref value
            
            // New room should be added with ref={0}
            const newRoomInResult = result.rooms.payload.find(ref => ref.sameKey(newRoom))
            expect(newRoomInResult?.ref).toBe(0)
        })
        
        it('should return a clone without mutating the original', () => {
            const message = new StandardMessage({ tag: 'Message', key: 'test' })
            const originalRoomsLength = message._payload.rooms.payload.length
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const { payload: result } = message._payload.assureReferences([roomRef])
            
            // Original should be unchanged
            expect(message._payload.rooms.payload.length).toBe(originalRoomsLength)
            // Result should have the new reference
            expect(result.rooms.payload.length).toBe(1)
            // They should be different objects
            expect(result).not.toBe(message._payload)
        })
        
        it('should be idempotent (calling multiple times with same children produces same result)', () => {
            const message = new StandardMessage({ tag: 'Message', key: 'test' })
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const { payload: firstPayload } = message._payload.assureReferences([roomRef])
            const { payload: secondPayload } = firstPayload.assureReferences([roomRef])
            
            // Both calls should produce the same result
            expect(firstPayload.rooms.payload.length).toBe(1)
            expect(secondPayload.rooms.payload.length).toBe(1)
            expect(firstPayload.rooms.payload[0].sameKey(secondPayload.rooms.payload[0])).toBe(true)
            expect(firstPayload.rooms.payload[0].ref).toBe(0)
            expect(secondPayload.rooms.payload[0].ref).toBe(0)
        })
        
        it('should dispatch children to correct bucket based on tag', () => {
            const message = new StandardMessage({ tag: 'Message', key: 'test' })
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const { payload: result } = message._payload.assureReferences([roomRef])
            
            // Verify reference went to the correct bucket
            expect(result.rooms.payload.length).toBe(1)
            expect(result.rooms.payload[0].sameKey(roomRef)).toBe(true)
        })
        
        it('should put non-bucket children in inlineRemainder', () => {
            const message = new StandardMessage({ tag: 'Message', key: 'test' })
            const markRef = new StandardReference({ tag: 'Mark', key: 'mark1' })
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const { payload: result, inlineRemainder } = message._payload.assureReferences([markRef, roomRef])
            
            // Room goes to bucket
            expect(result.rooms.payload.length).toBe(1)
            expect(result.rooms.payload[0].sameKey(roomRef)).toBe(true)
            // Mark goes to remainder
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].tag).toBe('Mark')
            expect(inlineRemainder[0].sameKey(markRef)).toBe(true)
            expect(inlineRemainder[0].ref).toBe(0)
        })
    })

    describe('removeReferences method', () => {
        it('should remove matching references from rooms bucket', () => {
            const message = new StandardMessage(deIndentWML(`
                <Message key=(test)>
                    <Room key=(room1) />
                    <Room key=(room2) />
                </Message>
            `))
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const result = message._payload.removeReferences([roomRef])
            
            // Verify matching reference was removed
            expect(result.rooms.payload.length).toBe(1)
            expect(result.rooms.payload[0].sameKey(new StandardReference({ tag: 'Room', key: 'room2' }))).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const message = new StandardMessage(deIndentWML(`
                <Message key=(test)>
                    <Room key=(room1) />
                </Message>
            `))
            const originalRoomsLength = message._payload.rooms.payload.length
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })
            
            const result = message._payload.removeReferences([roomRef])
            
            // Original should be unchanged
            expect(message._payload.rooms.payload.length).toBe(originalRoomsLength)
            // Result should have the reference removed
            expect(result.rooms.payload.length).toBe(0)
            // They should be different objects
            expect(result).not.toBe(message._payload)
        })
    })

})

describe('StandardMessage.equals semantic optionals', () => {
    it('treats undefined and semantic-empty description as equal', () => {
        const withoutDescription = new StandardMessage({
            key: 'test',
            tag: 'Message',
            rooms: [{ tag: 'Room', key: 'testRoom' }],
        })
        const withEmptyDescription = new StandardMessage({
            key: 'test',
            tag: 'Message',
            description: { data: { tag: 'Description' }, children: [] },
            rooms: [{ tag: 'Room', key: 'testRoom' }],
        })
        expect(withoutDescription.equals(withEmptyDescription)).toBe(true)
        expect(withEmptyDescription.equals(withoutDescription)).toBe(true)
    })
})