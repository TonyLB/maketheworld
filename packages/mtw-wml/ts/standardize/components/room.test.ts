import { excludeUndefined } from "../../lib/lists"
import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardRoomData } from "./dataTypes/room"
import { StandardRoom } from './room'
import { mergeTest } from "./utils/testing"

describe('StandardRoom class', () => {

    it('should construct StandardRoom from WML', () => {
        const testSource = deIndentWML(`
            <Room key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Name>Name Test</Name>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `)
        const testRoom = new StandardRoom(testSource)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testRoom.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] })
        expect(testRoom.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testRoom.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }])
        expect(testRoom.isRemove).toBe(false)
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should construct StandardRoom from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Room key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Name>Name Test</Name>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `)
        schema.loadWML(testSource)
        const testRoom = new StandardRoom(schema.schema[0])
        expect(testRoom.key).toEqual('test')
        expect(testRoom.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testRoom.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] })
        expect(testRoom.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testRoom.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }])
        expect(testRoom.isRemove).toBe(false)
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should construct StandardRoom removal from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Remove>
                <Room key=(test)>
                    <ShortName>ShortName Test</ShortName>
                    <Name>Name Test</Name>
                    <Summary>Summary Test</Summary>
                    <Description>Description Test</Description>
                    <Exit to=(testTwo)>Exit test</Exit>
                </Room>
            </Remove>
        `)
        schema.loadWML(testSource)
        const testRoom = new StandardRoom(schema.schema[0])
        expect(testRoom.key).toEqual('test')
        expect(testRoom.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testRoom.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] })
        expect(testRoom.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testRoom.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }])
        expect(testRoom.isRemove).toBe(true)
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should construct StandardRoom replace from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Asset key=(test)>
                <Replace>
                    <Room key=(test)>
                        <ShortName>ShortName</ShortName>
                        <Name>Name</Name>
                        <Summary>Summary</Summary>
                        <Description>Description</Description>
                        <Exit to=(testTwo)>Exit</Exit>
                    </Room>
                </Replace>
                <With>
                    <Room key=(test)>
                        <ShortName>ShortName Test</ShortName>
                        <Name>Name Test</Name>
                        <Summary>Summary Test</Summary>
                        <Description>Description Test</Description>
                        <Exit to=(testTwo)>Exit test</Exit>
                    </Room>
                </With>
            </Asset>
        `)
        schema.loadWML(testSource)
        const testRoom = new StandardRoom(schema.schema[0].children[0])
        expect(testRoom.key).toEqual('test')
        expect(testRoom.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testRoom.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] })
        expect(testRoom.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testRoom.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }])
        expect(testRoom.match).toBeTruthy()
        expect(testRoom.match?.key).toEqual('test')
        expect(testRoom.match?.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName' }, children: [] }] })
        expect(testRoom.match?.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name' }, children: [] }] })
        expect(testRoom.match?.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary' }, children: [] }] })
        expect(testRoom.match?.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description' }, children: [] }] })
        expect(testRoom.match?.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit' }, children: [] }] }])
        expect(testRoom.isRemove).toBe(false)
        expect(schemaToWML([{ data: { tag: 'Asset', key: 'test', Story: undefined }, children: [testRoom.schema] }])).toEqual(testSource)
    })

    it('should construct StandardRoom from StandardRoomData', () => {
        const testRoomData: StandardRoomData = {
            key: 'test',
            tag: 'Room',
            shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] },
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
            exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }],
            themes: []
        }
        const testRoom = new StandardRoom(testRoomData)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testRoom.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] })
        expect(testRoom.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testRoom.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }])
        expect(testRoom.match).toBe(undefined)
        expect(testRoom.isRemove).toBe(false)
        expect(testRoom.toJSON()).toEqual(testRoomData)
    })

    it('should construct StandardRoom removal from StandardRoomData', () => {
        const testRoomData: StandardRemoveData = {
            tag: 'Remove',
            key: 'test',
            component: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
                summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
                exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }],
                themes: []
            }
        }
        const testRoom = new StandardRoom(testRoomData)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testRoom.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] })
        expect(testRoom.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testRoom.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }])
        expect(testRoom.match).toBe(undefined)
        expect(testRoom.isRemove).toBe(true)
        expect(testRoom.toJSON()).toEqual(testRoomData)
    })

    it('should construct StandardRoom replace from StandardRoomData', () => {
        const testRoomData: StandardReplaceData = {
            tag: 'Replace',
            key: 'test',
            match: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name' }, children: [] }] },
                summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary' }, children: [] }] },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description' }, children: [] }] },
                exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit' }, children: [] }] }],
                themes: []
            },
            payload: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
                summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
                exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }],
                themes: []
            }
        }
        const testRoom = new StandardRoom(testRoomData)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testRoom.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] })
        expect(testRoom.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testRoom.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }])
        expect(testRoom.match).toBeTruthy()
        expect(testRoom.match?.key).toEqual('test')
        expect(testRoom.match?.shortName).toEqual({ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName' }, children: [] }] })
        expect(testRoom.match?.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name' }, children: [] }] })
        expect(testRoom.match?.summary).toEqual({ data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary' }, children: [] }] })
        expect(testRoom.match?.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description' }, children: [] }] })
        expect(testRoom.match?.exits).toEqual([{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit' }, children: [] }] }])
        expect(testRoom.isRemove).toBe(false)
        expect(testRoom.toJSON()).toEqual(testRoomData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Room key=(testRoomOne)>
                <Name>Lobby</Name>
                <Description>A plain lobby.</Description>
            </Room>`,
            StandardRoom,
            `<Room key=(testRoomOne)>
                <Replace><Name>Lobby</Name></Replace><With><Name>Spooky Lobby</Name></With>
                <Description><Space />Shadows cling to the corners of the room.</Description>
            </Room>`
        )).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Name>Spooky Lobby</Name>
                <Description>
                    A plain lobby.<Space />Shadows cling to the corners of the room.
                </Description>
            </Room>
        `))
    })

    it('should merge a replace component correctly', () => {
        const testRoomData: StandardRoomData = {
            key: 'test',
            tag: 'Room',
            shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName' }, children: [] }] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name' }, children: [] }] },
            summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary' }, children: [] }] },
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description' }, children: [] }] },
            exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit' }, children: [] }] }],
            themes: []
        }
        const testReplaceData: StandardReplaceData = {
            tag: 'Replace',
            key: 'test',
            match: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name' }, children: [] }] },
                summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary' }, children: [] }] },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description' }, children: [] }] },
                exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit' }, children: [] }] }],
                themes: []
            },
            payload: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
                summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
                exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }],
                themes: []
            }
        }
        const baseStandard = new StandardRoom(testRoomData)
        const testStandard = new StandardRoom(testReplaceData)
        const mergedStandard = baseStandard.merge(testStandard)
        expect(schemaToWML([mergedStandard?.schema].filter(excludeUndefined))).toEqual(deIndentWML(`
            <Room key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Name>Name Test</Name>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `))
    })

    it('should merge a remove component correctly', () => {
        const testRoomData: StandardRoomData = {
            key: 'test',
            tag: 'Room',
            shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName' }, children: [] }] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name' }, children: [] }] },
            summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary' }, children: [] }] },
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description' }, children: [] }] },
            exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit' }, children: [] }] }],
            themes: []
        }
        const testReplaceData: StandardRemoveData = {
            tag: 'Remove',
            key: 'test',
            component: {
                key: 'test',
                tag: 'Room',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name' }, children: [] }] },
                summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary' }, children: [] }] },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description' }, children: [] }] },
                exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit' }, children: [] }] }],
                themes: []
            }
        }
        const baseStandard = new StandardRoom(testRoomData)
        const testStandard = new StandardRoom(testReplaceData)
        const mergedStandard = baseStandard.merge(testStandard)
        expect(mergedStandard).toBeUndefined()
    })

    it('should generate NDJSON properly', () => {
        const test = new StandardRoom(deIndentWML(`
            <Room key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Name>Name Test</Name>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `)).withUniversalKey('ROOM#ABC')
        expect(test.toNDJSON({ from: { assetId: 'testAsset', key: 'Room1' }, exportAs: 'Room2' })).toEqual({
            tag: 'Room',
            key: 'test',
            exportAs: 'Room2',
            from: { assetId: 'testAsset', key: 'Room1' },
            shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            summary: { data: { tag: 'Summary' }, children: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }] },
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
            exits: [{ data: { tag: 'Exit', from: 'test', to: 'testTwo', key: 'test#testTwo' }, children: [{ data: { tag: 'String', value: 'Exit test' }, children: [] }] }],
            themes: [],
            universalKey: 'ROOM#ABC'
        })
    })

})