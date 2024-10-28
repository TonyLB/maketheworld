import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardMapData } from "./dataTypes/map"
import { StandardMap } from './map'

describe('StandardMap class', () => {
    it('should construct StandardMap from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Map key=(test)>
                <Name>Name Test</Name>
                <Image key=(testImage) />
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
            </Map>
        `)
        schema.loadWML(testSource)
        const testMap = new StandardMap(schema.schema[0])
        expect(testMap.key).toEqual('test')
        expect(testMap.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testMap.images).toEqual([{ data: { tag: 'Image', key: "testImage" }, children: [] }])
        expect(testMap.positions).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [{ data: { tag: 'Position', x: 100, y: 100 }, children: [] }] }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardRoom from StandardRoomData', () => {
        const testMapData: StandardMapData = {
            key: 'test',
            tag: 'Map',
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            images: [{ data: { tag: 'Image', key: "testImage" }, children: [] }],
            positions: [{ data: { tag: 'Room', key: "testRoom" }, children: [{ data: { tag: 'Position', x: 10, y: 100 }, children: [] }] }],
            themes: []
        }
        const testMap = new StandardMap(testMapData)
        expect(testMap.key).toEqual('test')
        expect(testMap.key).toEqual('test')
        expect(testMap.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testMap.images).toEqual([{ data: { tag: 'Image', key: "testImage" }, children: [] }])
        expect(testMap.positions).toEqual([{ data: { tag: 'Room', key: "testRoom" }, children: [{ data: { tag: 'Position', x: 10, y: 100 }, children: [] }] }])
        expect(testMap.toJSON()).toEqual(testMapData)
    })

    it('should merge correctly', () => {
        const baseSource = deIndentWML(`
            <Map key=(testMap)>
                <Name>Lobby</Name>
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
            </Map>
        `)
        const baseSchema = new Schema()
        baseSchema.loadWML(baseSource)
        const baseStandard = new StandardMap(baseSchema.schema[0])
        const testSource = deIndentWML(`
            <Map key=(testMap)>
                <Room key=(testRoomTwo)><Position x="100" y="50" /></Room>
            </Map>
        `)
        const testSchema = new Schema()
        testSchema.loadWML(testSource)
        const testStandard = new StandardMap(testSchema.schema[0])
        const mergedStandard = baseStandard.merge(testStandard)
        expect(schemaToWML([mergedStandard.schema])).toEqual(deIndentWML(`
            <Map key=(testMap)>
                <Name>Lobby</Name>
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
                <Room key=(testRoomTwo)><Position x="100" y="50" /></Room>
            </Map>
        `))
    })
})