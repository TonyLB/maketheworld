import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardThemeData } from "./dataTypes/theme"
import StandardTheme from './theme'
import { mergeTest } from './utils/testing'

describe('StandardTheme class', () => {

    it('should construct StandardTheme from WML', () => {
        const testSource = deIndentWML(`
            <Theme key=(test)>
                <Name>Name Test</Name>
                <Prompt>Spooky</Prompt>
                <Room key=(testRoom) />
                <Map key=(testMap) />
            </Theme>
        `)
        const testMap = new StandardTheme(testSource)
        expect(testMap.key).toEqual('test')
        expect(testMap.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testMap.prompts).toEqual([{ data: { tag: 'Prompt', value: 'Spooky' }, children: [] }])
        expect(testMap.rooms).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [] }])
        expect(testMap.maps).toEqual([{ data: { tag: 'Map', key: "testMap" }, children: [] }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardTheme from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Theme key=(test)>
                <Name>Name Test</Name>
                <Prompt>Spooky</Prompt>
                <Room key=(testRoom) />
                <Map key=(testMap) />
            </Theme>
        `)
        schema.loadWML(testSource)
        const testMap = new StandardTheme(schema.schema[0])
        expect(testMap.key).toEqual('test')
        expect(testMap.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testMap.prompts).toEqual([{ data: { tag: 'Prompt', value: 'Spooky' }, children: [] }])
        expect(testMap.rooms).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [] }])
        expect(testMap.maps).toEqual([{ data: { tag: 'Map', key: "testMap" }, children: [] }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardTheme from StandardThemeData', () => {
        const testMapData: StandardThemeData = {
            key: 'test',
            tag: 'Theme',
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            prompts: [{ data: { tag: 'Prompt', value: 'Spooky' }, children: [] }],
            rooms: [{ data: { tag: 'Room', key: "testRoom" }, children: [] }],
            maps: [{ data: { tag: 'Map', key: "testMap" }, children: [] }]
        }
        const testMap = new StandardTheme(testMapData)
        expect(testMap.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testMap.prompts).toEqual([{ data: { tag: 'Prompt', value: 'Spooky' }, children: [] }])
        expect(testMap.rooms).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [] }])
        expect(testMap.maps).toEqual([{ data: { tag: 'Map', key: "testMap" }, children: [] }])
        expect(testMap.toJSON()).toEqual(testMapData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Theme key=(test)>
                <Name>Test Name</Name>
                <Room key=(testRoom) />
            </Theme>`,
            StandardTheme,
            `<Theme key=(test)>
                <Prompt>Cozy</Prompt>
                <Room key=(testRoomTwo) />
            </Theme>`
        )).toEqual(deIndentWML(`
            <Theme key=(test)>
                <Name>Test Name</Name>
                <Prompt>Cozy</Prompt>
                <Room key=(testRoom) />
                <Room key=(testRoomTwo) />
            </Theme>
        `))
    })
})