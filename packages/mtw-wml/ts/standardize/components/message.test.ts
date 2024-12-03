import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardMessageData } from "./dataTypes/message"
import { StandardMessageRefactored as StandardMessage } from './message'
import { mergeTest } from './utils/testing'

describe('StandardMessage class', () => {

    it('should construct StandardMessage from WML', () => {
        const testSource = deIndentWML(`
            <Message key=(test)><Room key=(testRoom) />Message Test</Message>
        `)
        const testMap = new StandardMessage(testSource)
        expect(testMap.key).toEqual('test')
        expect(testMap.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] })
        expect(testMap.rooms).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [] }])
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
        expect(testMap.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] })
        expect(testMap.rooms).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [] }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardMessage from StandardMessageData', () => {
        const testMapData: StandardMessageData = {
            key: 'test',
            tag: 'Message',
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] },
            rooms: [{ data: { tag: 'Room', key: "testRoom" }, children: [] }],
        }
        const testMap = new StandardMessage(testMapData)
        expect(testMap.key).toEqual('test')
        expect(testMap.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] })
        expect(testMap.rooms).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [] }])
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
                Message test<Space />(extended)
            </Message>
        `))
    })
})