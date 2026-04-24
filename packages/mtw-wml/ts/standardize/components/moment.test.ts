import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardMomentData } from "./dataTypes/moment"
import StandardMoment from './moment'
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { mergeTest } from './utils/testing'

describe('StandardMoment class', () => {

    it('should construct StandardMoment from WML', () => {
        const testSource = deIndentWML(`
            <Moment uuid=(001) key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        expect(testMoment.universalKey).toEqual('MOMENT#001')
        expect(testMoment.key).toEqual('test')
        expect(testMoment.messages.toJSON()).toEqual([{ tag: 'Message', key: 'testMessage' }])
        expect(schemaToWML([testMoment.schema])).toEqual(testSource)
    })

    it('should construct StandardMoment from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        schema.loadWML(testSource)
        const testMoment = new StandardMoment(schema.schema[0])
        expect(testMoment.key).toEqual('test')
        expect(testMoment.messages.toJSON()).toEqual([{ tag: 'Message', key: 'testMessage' }])
        expect(schemaToWML([testMoment.schema])).toEqual(testSource)
    })

    it('should construct StandardMoment from StandardMomentData', () => {
        const testMomentData: StandardMomentData = {
            key: 'test',
            tag: 'Moment',
            messages: [{ tag: 'Message', key: 'testMessage' }]
        }
        const testMoment = new StandardMoment(testMomentData)
        expect(testMoment.messages.toJSON()).toEqual([{ tag: 'Message', key: 'testMessage' }])
        expect(testMoment.toJSON()).toEqual(testMomentData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Moment uuid=(Moment1) key=(test)><Message key=(testMessage) /></Moment>',
            StandardMoment,
            '<Moment uuid=(Moment1) key=(test)><Message key=(testMessageTwo) /></Moment>'
        )).toEqual(deIndentWML(`
            <Moment uuid=(Moment1) key=(test)>
                <Message key=(testMessage) />
                <Message key=(testMessageTwo) />
            </Moment>
        `))
    })

    it('should correctly merge removing a message', () => {
        expect(mergeTest(
            '<Moment key=(test)><Message key=(testMessage) /><Message key=(testMessageTwo) /></Moment>',
            StandardMoment,
            '<Moment key=(test)><Remove><Message key=(testMessageTwo) /></Remove></Moment>'
        )).toEqual(deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `))
    })

    it('should correctly no-op on diff of identical objects', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        expect(testMoment.diff(testMoment)).toBeUndefined()
    })

    it('should treat undefined and empty shortName as equal', () => {
        const withoutShortName = new StandardMoment({
            tag: 'Moment',
            key: 'test',
            messages: [{ tag: 'Message', key: 'msg1' }]
        })
        const withEmptyShortName = new StandardMoment({
            tag: 'Moment',
            key: 'test',
            shortName: '',
            messages: [{ tag: 'Message', key: 'msg1' }]
        })

        expect(withoutShortName.equals(withEmptyShortName)).toBe(true)
        expect(withEmptyShortName.equals(withoutShortName)).toBe(true)
    })

    it('should correctly diff adding a message', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        const testSource2 = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /><Message key=(testMessageTwo) /></Moment>
        `)
        const testMoment2 = new StandardMoment(testSource2)
        expect(testMoment.diff(testMoment2)?.schema).toEqual((new StandardMoment(`
            <Moment key=(test)><Message key=(testMessageTwo) /></Moment>
        `)).schema)
    })

    it('should correctly diff removing a message', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /><Message key=(testMessageTwo) /></Moment>
        `)
        const testMoment = new StandardMoment(testSource)
        const testSource2 = deIndentWML(`
            <Moment key=(test)><Message key=(testMessage) /></Moment>
        `)
        const testMoment2 = new StandardMoment(testSource2)
        expect(testMoment.diff(testMoment2)?.schema).toEqual((new StandardMoment(`
            <Moment key=(test)><Remove><Message key=(testMessageTwo) /></Remove></Moment>
        `)).schema)
    })

    it('should correctly add a message reference to a moment', () => {
        const test = new StandardMoment(`
            <Moment key=(test)><Message uuid=(Message1) /></Moment>
        `)
        const message = new StandardKey("MESSAGE#Message2")
        const added = test.withChild(new StandardReference(message))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Moment key=(test)>
                <Message uuid=(Message1) />
                <Message uuid=(Message2) />
            </Moment>
        `))
    })

    it('should throw on unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Moment key=(test)>
                <Message key=(msg1) />
                <Map key=(illegalMap) />
            </Moment>
        `)
        expect(() => new StandardMoment(testSource)).toThrow(/Unconsumed child tags/)
        expect(() => new StandardMoment(testSource)).toThrow(/Map/)
    })

    describe('assureReferences method', () => {
        it('should return unchanged moment when children array is empty', () => {
            const moment = new StandardMoment({ tag: 'Moment', key: 'test' })
            const { payload: result, inlineRemainder } = moment._payload.assureReferences([])
            
            expect(result.messages.payload.length).toBe(0)
            expect(inlineRemainder).toEqual([])
            // Verify it's a clone (original unchanged)
            expect(moment._payload.messages.payload.length).toBe(0)
        })
        
        it('should add children with ref={0} when they do not exist', () => {
            const moment = new StandardMoment({ tag: 'Moment', key: 'test' })
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const { payload: result } = moment._payload.assureReferences([messageRef])
            
            // Verify reference was added with ref={0}
            expect(result.messages.payload.length).toBe(1)
            expect(result.messages.payload[0].ref).toBe(0)
            expect(result.messages.payload[0].sameKey(messageRef)).toBe(true)
        })
        
        it('should leave existing references with non-zero ref unchanged', () => {
            const moment = new StandardMoment(deIndentWML(`
                <Moment key=(test)>
                    <Message key=(msg1) />
                </Moment>
            `))
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const { payload: result } = moment._payload.assureReferences([messageRef])
            
            // Verify existing reference was left unchanged
            expect(result.messages.payload.length).toBe(1)
            expect(result.messages.payload[0].ref).toBe(1) // Original ref value (default)
        })
        
        it('should handle mixed scenarios (some exist, some do not)', () => {
            const moment = new StandardMoment(deIndentWML(`
                <Moment key=(test)>
                    <Message key=(existingMsg) />
                </Moment>
            `))
            const existingMessage = new StandardReference({ tag: 'Message', key: 'existingMsg' })
            const newMessage = new StandardReference({ tag: 'Message', key: 'newMsg' })
            
            const { payload: result } = moment._payload.assureReferences([existingMessage, newMessage])
            
            // Existing message should be unchanged
            expect(result.messages.payload.length).toBe(2)
            const existingMsgInResult = result.messages.payload.find(ref => ref.sameKey(existingMessage))
            expect(existingMsgInResult?.ref).toBe(1) // Original ref value
            
            // New message should be added with ref={0}
            const newMsgInResult = result.messages.payload.find(ref => ref.sameKey(newMessage))
            expect(newMsgInResult?.ref).toBe(0)
        })
        
        it('should return a clone without mutating the original', () => {
            const moment = new StandardMoment({ tag: 'Moment', key: 'test' })
            const originalMessagesLength = moment._payload.messages.payload.length
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const { payload: result } = moment._payload.assureReferences([messageRef])
            
            // Original should be unchanged
            expect(moment._payload.messages.payload.length).toBe(originalMessagesLength)
            // Result should have the new reference
            expect(result.messages.payload.length).toBe(1)
            // They should be different objects
            expect(result).not.toBe(moment._payload)
        })
        
        it('should be idempotent (calling multiple times with same children produces same result)', () => {
            const moment = new StandardMoment({ tag: 'Moment', key: 'test' })
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const { payload: firstPayload } = moment._payload.assureReferences([messageRef])
            const { payload: secondPayload } = firstPayload.assureReferences([messageRef])
            
            // Both calls should produce the same result
            expect(firstPayload.messages.payload.length).toBe(1)
            expect(secondPayload.messages.payload.length).toBe(1)
            expect(firstPayload.messages.payload[0].sameKey(secondPayload.messages.payload[0])).toBe(true)
            expect(firstPayload.messages.payload[0].ref).toBe(0)
            expect(secondPayload.messages.payload[0].ref).toBe(0)
        })
        
        it('should dispatch children to correct bucket based on tag', () => {
            const moment = new StandardMoment({ tag: 'Moment', key: 'test' })
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const { payload: result } = moment._payload.assureReferences([messageRef])
            
            // Verify reference went to the correct bucket
            expect(result.messages.payload.length).toBe(1)
            expect(result.messages.payload[0].sameKey(messageRef)).toBe(true)
        })
        
        it('should put non-bucket children in inlineRemainder', () => {
            const moment = new StandardMoment({ tag: 'Moment', key: 'test' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const { payload: result, inlineRemainder } = moment._payload.assureReferences([exampleRef, messageRef])
            
            // Message goes to bucket
            expect(result.messages.payload.length).toBe(1)
            expect(result.messages.payload[0].sameKey(messageRef)).toBe(true)
            // Example goes to remainder
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].tag).toBe('Example')
            expect(inlineRemainder[0].sameKey(exampleRef)).toBe(true)
            expect(inlineRemainder[0].ref).toBe(0)
        })
    })

    describe('removeReferences method', () => {
        it('should remove matching references from messages bucket', () => {
            const moment = new StandardMoment(deIndentWML(`
                <Moment key=(test)>
                    <Message key=(msg1) />
                    <Message key=(msg2) />
                </Moment>
            `))
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const result = moment._payload.removeReferences([messageRef])
            
            // Verify matching reference was removed
            expect(result.messages.payload.length).toBe(1)
            expect(result.messages.payload[0].sameKey(new StandardReference({ tag: 'Message', key: 'msg2' }))).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const moment = new StandardMoment(deIndentWML(`
                <Moment key=(test)>
                    <Message key=(msg1) />
                </Moment>
            `))
            const originalMessagesLength = moment._payload.messages.payload.length
            const messageRef = new StandardReference({ tag: 'Message', key: 'msg1' })
            
            const result = moment._payload.removeReferences([messageRef])
            
            // Original should be unchanged
            expect(moment._payload.messages.payload.length).toBe(originalMessagesLength)
            // Result should have the reference removed
            expect(result.messages.payload.length).toBe(0)
            // They should be different objects
            expect(result).not.toBe(moment._payload)
        })
    })
    
})
