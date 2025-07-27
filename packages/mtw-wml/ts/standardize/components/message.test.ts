import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardMessageData } from "./dataTypes/message"
import StandardMessage from './message'
import { mergeTest } from './utils/testing'
import StandardReference, { StandardKey } from "./reference"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"

describe('StandardMessage class', () => {

    it('should construct StandardMessage from WML', () => {
        const testSource = deIndentWML(`
            <Message uuid=(001) key=(test)><Room key=(testRoom) />Message Test</Message>
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
            <Message key=(test)><Room key=(testRoom) />Message Test</Message>
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
                Message test
                <Room key=(testRoom) />
            </Message>`,
            StandardMessage,
            `<Message key=(test)>
                <Space />(extended)
                <Room key=(testRoomTwo) />
            </Message>`
        )).toEqual(deIndentWML(`
            <Message key=(test)>
                <Room key=(testRoom) />
                <Room key=(testRoomTwo) />
                Message test (extended)
            </Message>
        `))
    })

    it('should map contents on name', () => {
        const test = new StandardMessage(`
            <Message key=(test)>
                Message test.
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
            <Message key=(test)><Room key=(testRoom) />Message test.Narf!</Message>
        `))
    })

    it('should remap references', () => {
        const test = new StandardMessage(`
            <Message key=(test)>
                Message test.<Link to=(feature1) />
                <Room key=(testRoom) />
            </Message>
        `)
        const mappings = [new StandardKey({ key: 'feature1', tag: 'Feature', universalKey: 'FEATURE#feature1' }), new StandardKey({ key: 'testRoom', tag: 'Room', universalKey: 'ROOM#testRoom' })]
        const remapped = test.withMapping(mappings).remapReferences('universal')
        expect(schemaToWML([remapped.schema])).toEqual(deIndentWML(`
            <Message key=(test)>
                <Room uuid=(testRoom) />Message test.<Link to=(FEATURE#feature1) />
            </Message>
        `))
    })

    it('should correctly add a room reference to a message', () => {
        const test = new StandardMessage(`
            <Message key=(testMessage)>
                Message test.<Link to=(feature1) />
                <Room key=(testRoomOne) />
            </Message>
        `)
        const room = new StandardKey({ tag: 'Room', key: 'testRoomTwo' })
        const added = test.withChild(new StandardReference(room))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Message key=(testMessage)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo) />
                Message test.<Link to=(feature1) />
            </Message>
        `))
    })

})