import { Schema, schemaToWML } from "../../schema"
import { isSchemaDescription, isSchemaString } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardMessageData } from "./dataTypes/message"
import StandardMessage from './message'
import { mergeTest } from './utils/testing'

describe('StandardMessage class', () => {

    it('should construct StandardMessage from WML', () => {
        const testSource = deIndentWML(`
            <Message uuid=(001) key=(test)><Room key=(testRoom) />Message Test</Message>
        `)
        const testMap = new StandardMessage(testSource)
        expect(testMap.universalKey).toEqual('MESSAGE#001')
        expect(testMap.key).toEqual('test')
        expect(testMap.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] })
        expect(testMap.rooms.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Room', key: "testRoom" }])
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
        expect(testMap.rooms.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Room', key: "testRoom" }])
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
        expect(testMap.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Message Test' }, children: [] }] })
        expect(testMap.rooms.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Room', key: "testRoom" }])
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
})