import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardMapData } from "./dataTypes/map"
import StandardMap, { StandardMapPayload } from './map'
import { mergeTest } from "./utils/testing"
import { isSchemaPosition, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"

describe('StandardMap class', () => {

    it('should construct StandardMap from WML', () => {
        const testSource = deIndentWML(`
            <Map uuid=(001) key=(test)>
                <ShortName>Name Test</ShortName>
                <Image key=(testImage) />
                <Room key=(testRoom)><Position {100, 100} /></Room>
            </Map>
        `)
        const testMap = new StandardMap(testSource)
        expect(testMap.universalKey).toEqual('MAP#001')
        expect(testMap.key).toEqual('test')
        expect(testMap.shortName?.toJSON()).toEqual('Name Test')
        expect(testMap.images).toEqual([{ data: { tag: 'Image', key: "testImage" }, children: [] }])
        expect(testMap.positions.toJSON()).toEqual([{ reference: { key: "testRoom", tag: 'Room' }, payload: { x: 100, y: 100 } }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardMap from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Map key=(test)>
                <ShortName>Name Test</ShortName>
                <Image key=(testImage) />
                <Room key=(testRoom)><Position {100, 100} /></Room>
            </Map>
        `)
        schema.loadWML(testSource)
        const testMap = new StandardMap(schema.schema[0])
        expect(testMap.key).toEqual('test')
        expect(testMap.shortName?.toJSON()).toEqual('Name Test')
        expect(testMap.images).toEqual([{ data: { tag: 'Image', key: "testImage" }, children: [] }])
        expect(testMap.positions.toJSON()).toEqual([{ reference: { key: "testRoom", tag: 'Room' }, payload: { x: 100, y: 100 } }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardMap from StandardMapData', () => {
        const testMapData: StandardMapData = {
            key: 'test',
            tag: 'Map',
            shortName: 'Name Test',
            images: [{ data: { tag: 'Image', key: "testImage" }, children: [] }],
            positions: [{ reference: { key: "testRoom", tag: 'Room' }, payload: { x: 10, y: 100 } }]
        }
        const testMap = new StandardMap(testMapData)
        expect(testMap.key).toEqual('test')
        expect(testMap.shortName?.toJSON()).toEqual('Name Test')
        expect(testMap.images).toEqual([{ data: { tag: 'Image', key: "testImage" }, children: [] }])
        expect(testMap.positions.items.map((position) => (position.toJSON()))).toEqual([{ 
            reference: { key: "testRoom", tag: "Room", universalKey: undefined }, 
            payload: { x: 10, y: 100 } 
        }])
        expect(testMap.toJSON()).toEqual(testMapData)
    })


    it('should construct StandardMap from StandardMapData with explicit parent', () => {
        const testMap = new StandardMap(deIndentWML(`
            <Map key=(testMap)>
                <Room key=(testRoom)>
                    <Parent />
                    <Position {100, 100} />
                </Room>
                <Room key=(testRoomTwo)>
                    <Position {100, 100} />
                </Room>
            </Map>
        `))
        expect(testMap.positions.items.map((position) => (position.toJSON()))).toEqual([
            { 
                reference: { key: "testRoom", tag: "Room", universalKey: undefined }, 
                payload: { x: 100, y: 100 } 
            }, 
            { 
                reference: { key: "testRoomTwo", tag: "Room", universalKey: undefined }, 
                payload: { x: 100, y: 100 } 
            }
        ])
    })

    it('should ignore non-position children of Room tags', () => {
        const testMap = new StandardMap(deIndentWML(`
            <Map key=(testMap)>
                <ShortName>Lobby</ShortName>
                <Room key=(testRoom)>
                    <Position {100, 100} />
                    <ShortName>Room Name</ShortName>
                    <Exit to=(testRoomTwo)>Exit</Exit>
                </Room>
            </Map>
        `))
        expect(testMap.positions.toJSON()).toEqual([{ reference: { key: "testRoom", tag: 'Room' }, payload: { x: 100, y: 100 } }])
    })

    it('should construct StandardMap from StandardMapData with missing images and positions', () => {
        const testMapDataWithoutImagesAndPositions: StandardMapData = {
            key: 'test',
            tag: 'Map',
            shortName: 'Name Test'
            // images and positions properties are missing - this should not crash
        }
        const testMap = new StandardMap(testMapDataWithoutImagesAndPositions)
        expect(testMap.key).toEqual('test')
        expect(testMap.shortName?.toJSON()).toEqual('Name Test')
        expect(testMap.images).toEqual([])  // Should default to empty array
        expect(testMap.positions.items).toEqual([])  // Should default to empty array
        
        // The JSON output should omit images and positions when empty (omission-over-empty pattern)
        const outputJSON = testMap.toJSON() as StandardMapData
        expect(outputJSON.images).toBeUndefined()
        expect(outputJSON.positions).toBeUndefined()
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Map key=(testMap)>
                <ShortName>Lobby</ShortName>
                <Room key=(testRoom)><Position {100, 100} /></Room>
            </Map>`,
            StandardMap,
            `<Map key=(testMap)>
                <Room key=(testRoomTwo)><Position {100, 50} /></Room>
            </Map>`
        )).toEqual(deIndentWML(`
            <Map key=(testMap)>
                <ShortName>Lobby</ShortName>
                <Room key=(testRoom)><Position {100, 100} /></Room>
                <Room key=(testRoomTwo)><Position {100, 50} /></Room>
            </Map>
        `))
    })

    it('should return remainder with Rooms stripped of Position tags', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Map key=(test)>
                <ShortName>Name Test</ShortName>
                <Image key=(testImage) />
                <Room key=(testRoom)><Position {100, 100} /><ShortName>Room Name</ShortName></Room>
            </Map>
        `)
        schema.loadWML(testSource)
        const mapNode = schema.schema[0]
        const payload = new StandardMapPayload()
        const remainder = payload.fromSchema(mapNode)

        expect(remainder).toHaveLength(2)
        const roomNode = remainder.find(node => treeNodeTypeguard(isSchemaRoom)(node))!
        expect(treeNodeTypeguard(isSchemaRoom)(roomNode)).toBe(true)

        const positionChildren = roomNode.children.filter(treeNodeTypeguard(isSchemaPosition))
        expect(positionChildren.length).toBe(0)

        const shortNameChildren = roomNode.children.filter(child => child.data.tag === 'ShortName')
        expect(shortNameChildren.length).toBe(1)
    })

})