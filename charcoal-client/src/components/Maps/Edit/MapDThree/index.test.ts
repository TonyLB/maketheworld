import { describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'
import { MapDThree } from '.'
jest.mock('./treeToSimulation')
import treeToSimulationRaw from './treeToSimulation'

import { mockFunction, mockClass } from '../../../../lib/jestHelpers'
const treeToSimulation = mockFunction(treeToSimulationRaw)
const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

describe('MapDThree', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should initialize layers on construction', () => {
        treeToSimulation.mockReturnValue([{
            key: 'Two',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: false,
                x: 300,
                y: 300,
                visible: true
            }],
            links: []
        },
        {
            key: 'One',
            nodes: [{
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
            }],
            links: []
        }])
        //
        // TODO: Reconfigure MapDThreeIterator to be more of a black-box, with getter
        // functions that can be overwritten for testing (instead of MapDThree directly
        // reading and writing its properties, in untestable ways)
        //
        // jest.spyOn(MapDThreeIterator.prototype, 'nodes', 'get').mockReturnValue([])
        const testMapDThree = new MapDThree({ tree: [] })
        expect(treeToSimulation).toHaveBeenCalledWith([])
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