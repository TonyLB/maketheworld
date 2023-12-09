import { jest, beforeEach, describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeStack.ts')
import MapDThreeStackRaw from './MapDThreeStack'
import { MapDThree, mapTreeTranslate } from '.'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { MapTreeItem } from '../../Controller/baseClasses'
const MapDThreeStack = mockClass(MapDThreeStackRaw)

describe('mapTreeTranslate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should aggregate nodes and links', () => {
        const testTree: GenericTree<MapTreeItem> = [
            { data: { tag: 'Room', key: 'Room1', x: 100, y: 100, name: [], render: [], contents: [] }, children: [] },
            { data: { tag: 'Room', key: 'Room2', x: 0, y: 100, name: [], render: [], contents: [] }, children: [
                { data: { tag: 'Exit', to: 'Room1', from: 'Room2', key: 'Room2#Room1', name: 'TestExit', contents: [] }, children: [] }
            ] }
        ]

        expect(mapTreeTranslate(testTree)).toEqual([{
            data: {
                nodes: [
                    { id: 'Room1', roomId: 'Room1', x: 100, y: 100, visible: true, cascadeNode: true },
                    { id: 'Room2', roomId: 'Room2', x: 0, y: 100, visible: true, cascadeNode: true }
                ],
                links: [
                    { id: 'Room2#Room1', source: 'Room2', target: 'Room1' }
                ],
                visible: true,
                key: ''
            },
            children: []
        }])
    })

})

// describe('MapDThree', () => {
//     beforeEach(() => {
//         jest.clearAllMocks()
//         jest.resetAllMocks()
//     })

//     it('should initialize stack on construction', () => {

//         const testMapDThree = new MapDThree({ roomLayers: [{
//             key: 'Two',
//             rooms: {
//                 GHI: {
//                     id: 'Two-A',
//                     roomId: 'GHI',
//                     x: 300,
//                     y: 300
//                 }
//             },
//             roomVisibility: {
//                 GHI: true
//             }
//         },
//         {
//             key: 'One',
//             rooms: {
//                 DEF: {
//                     id: 'One-B',
//                     roomId: 'DEF',
//                     x: 300,
//                     y: 200
//                 },
//                 ABC: {
//                     id: 'One-A',
//                     roomId: 'ABC',
//                     x: 200,
//                     y: 200
//                 }
//             },
//             roomVisibility: {
//                 DEF: true,
//                 ABC: true
//             }
//         }], exits: [] })
//         expect(MapDThreeStack).toHaveBeenCalledTimes(2)
//         expect(MapDThreeStack.mock.calls[0]).toEqual([{ layers: [] }])
//         expect(MapDThreeStack.mock.calls[1]).toMatchSnapshot()

//     })
// })