import { Schema, schemaToWML } from "../../schema"
import { isSchemaName, isSchemaPosition } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardMapData } from "./dataTypes/map"
import StandardMap from './map'
import { mergeTest } from "./utils/testing"

describe('StandardMap class', () => {

    it('should construct StandardMap from WML', () => {
        const testSource = deIndentWML(`
            <Map uuid=(001) key=(test)>
                <Name>Name Test</Name>
                <Image key=(testImage) />
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
            </Map>
        `)
        const testMap = new StandardMap(testSource)
        expect(testMap.universalKey).toEqual('MAP#001')
        expect(testMap.key).toEqual('test')
        expect(testMap.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testMap.images).toEqual([{ data: { tag: 'Image', key: "testImage" }, children: [] }])
        expect(testMap.positions.map((position) => (position.toJSON()))).toEqual([{ room: { tag: 'Room', key: "testRoom" }, x: 100, y: 100 }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

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
        expect(testMap.positions.map((position) => (position.toJSON()))).toEqual([{ room: { tag: 'Room', key: "testRoom" }, x: 100, y: 100 }])
        expect(schemaToWML([testMap.schema])).toEqual(testSource)
    })

    it('should construct StandardMap from StandardMapData', () => {
        const testMapData: StandardMapData = {
            key: 'test',
            tag: 'Map',
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            images: [{ data: { tag: 'Image', key: "testImage" }, children: [] }],
            positions: [{ room: { tag: 'Room', key: "testRoom" }, x: 10, y: 100 }]
        }
        const testMap = new StandardMap(testMapData)
        expect(testMap.key).toEqual('test')
        expect(testMap.key).toEqual('test')
        expect(testMap.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testMap.images).toEqual([{ data: { tag: 'Image', key: "testImage" }, children: [] }])
        expect(testMap.positions.map((position) => (position.toJSON()))).toEqual([{ room: { tag: 'Room', key: "testRoom" }, x: 10, y: 100 }])
        expect(testMap.toJSON()).toEqual(testMapData)
    })

    it('should ignore non-position children of Room tags', () => {
        const testMap = new StandardMap(deIndentWML(`
            <Map key=(testMap)>
                <Name>Lobby</Name>
                <Room key=(testRoom)>
                    <Position x="100" y="100" />
                    <Name>Room Name</Name>
                    <Exit to=(testRoomTwo)>Exit</Exit>
                </Room>
            </Map>
        `))
        expect(testMap.positions.map((position) => (position.toJSON()))).toEqual([{ room: { tag: 'Room', key: "testRoom" }, x: 100, y: 100 }])
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Map key=(testMap)>
                <Name>Lobby</Name>
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
            </Map>`,
            StandardMap,
            `<Map key=(testMap)>
                <Room key=(testRoomTwo)><Position x="100" y="50" /></Room>
            </Map>`
        )).toEqual(deIndentWML(`
            <Map key=(testMap)>
                <Name>Lobby</Name>
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
                <Room key=(testRoomTwo)><Position x="100" y="50" /></Room>
            </Map>
        `))
    })

    it('should map contents on name', () => {
        const test = new StandardMap(`
            <Map key=(testMap)>
                <Name>Lobby</Name>
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
                <Room key=(testRoomTwo)><Position x="100" y="50" /></Room>
            </Map>
        `)
        const callback = (tree) => {
            return tree.map((node) => {
                if (treeNodeTypeguard(isSchemaName)(node)) {
                    return {
                        ...node,
                        children: [...node.children, { data: { tag: 'String', value: 'Narf!' }, children: [] }]
                    }
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
            <Map key=(testMap)>
                <Name>LobbyNarf!</Name>
                <Room key=(testRoom)><Position x="100" y="100" /></Room>
                <Room key=(testRoomTwo)><Position x="100" y="50" /></Room>
            </Map>
        `))
    })

    // it('should map contents on positions', () => {
    //     const test = new StandardMap(`
    //         <Map key=(testMap)>
    //             <Name>Lobby</Name>
    //             <Room key=(testRoom)><Position x="100" y="100" /></Room>
    //             <Room key=(testRoomTwo)><Position x="100" y="50" /></Room>
    //         </Map>
    //     `)
    //     const callback = (tree) => {
    //         return tree.map((node) => {
    //             if (treeNodeTypeguard(isSchemaPosition)(node)) {
    //                 return {
    //                     data: {
    //                         ...node.data,
    //                         x: node.data.x + 42
    //                     },
    //                     children: callback(node.children)
    //                 }
    //             }
    //             else {
    //                 return {
    //                     ...node,
    //                     children: callback(node.children)
    //                 }
    //             }
    //         })
    //     }
    //     expect(schemaToWML([test.mapContents(callback).schema])).toEqual(deIndentWML(`
    //         <Map key=(testMap)>
    //             <Name>Lobby</Name>
    //             <Room key=(testRoom)><Position x="142" y="100" /></Room>
    //             <Room key=(testRoomTwo)><Position x="142" y="50" /></Room>
    //         </Map>
    //     `))
    // })

})