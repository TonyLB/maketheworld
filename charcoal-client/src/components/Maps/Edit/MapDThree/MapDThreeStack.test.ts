import { jest, beforeEach, describe, it, expect } from '@jest/globals'
import { MapTree } from '../maps'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'
import { MapDThreeStack } from './MapDThreeStack'

import { mockFunction, mockClass } from '../../../../lib/jestHelpers'
const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

describe('MapDThreeStack', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should initialize layers on construction', () => {

        //
        // TODO: Reconfigure MapDThreeIterator to be more of a black-box, with getter
        // functions that can be overwritten for testing (instead of MapDThree directly
        // reading and writing its properties, in untestable ways)
        //
        // jest.spyOn(MapDThreeIterator.prototype, 'nodes', 'get').mockReturnValue([])
        const testMapDThree = new MapDThreeStack({
            layers: [{
                key: 'Two',
                nodes: [{
                    id: 'Two-A',
                    roomId: 'GHI',
                    x: 300,
                    y: 300,
                    visible: true,
                    cascadeNode: false
                }],
                links: []
            },
            {
                key: 'One',
                nodes: [{
                    id: 'Two-A',
                    roomId: 'GHI',
                    x: 300,
                    y: 300,
                    visible: true,
                    cascadeNode: true
                },
                {
                    id: 'One-B',
                    roomId: 'DEF',
                    x: 300,
                    y: 200,
                    visible: true,
                    cascadeNode: false
                },
                {
                    id: 'One-A',
                    roomId: 'ABC',
                    x: 200,
                    y: 200,
                    visible: true,
                    cascadeNode: false
                }],
                links: []
            }]
        })
        expect(MapDThreeIterator).toHaveBeenCalledTimes(2)
        expect(MapDThreeIterator).toHaveBeenCalledWith("Two", [{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true
        }], [], expect.any(Function))
        expect(MapDThreeIterator).toHaveBeenCalledWith("One", [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: true,
                x: 300,
                y: 300,
                visible: true
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                cascadeNode: false,
                x: 300,
                y: 200,
                visible: true
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                cascadeNode: false,
                x: 200,
                y: 200,
                visible: true
            }], [], expect.any(Function)
        )
        // expect(testMapDThree.nodes).toEqual([])
    })
})