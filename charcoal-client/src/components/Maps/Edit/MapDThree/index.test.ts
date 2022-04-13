import { jest, beforeEach, describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeStack.ts')
import MapDThreeStackRaw from './MapDThreeStack'
import { MapDThree } from '.'
jest.mock('./treeToSimulation')
import treeToSimulationRaw from './treeToSimulation'

import { mockFunction, mockClass } from '../../../../lib/jestHelpers'
const treeToSimulation = mockFunction(treeToSimulationRaw)
const MapDThreeStack = mockClass(MapDThreeStackRaw)

describe('MapDThree', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should initialize stack on construction', () => {
        const simulationLayers = [{
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
        }]
        treeToSimulation.mockReturnValue(simulationLayers)
        //
        // TODO: Reconfigure MapDThreeIterator to be more of a black-box, with getter
        // functions that can be overwritten for testing (instead of MapDThree directly
        // reading and writing its properties, in untestable ways)
        //
        // jest.spyOn(MapDThreeIterator.prototype, 'nodes', 'get').mockReturnValue([])
        const testMapDThree = new MapDThree({ tree: [] })
        expect(treeToSimulation).toHaveBeenCalledWith([])
        expect(MapDThreeStack).toHaveBeenCalledTimes(2)
        expect(MapDThreeStack).toHaveBeenCalledWith({ layers: [] })
        expect(MapDThreeStack).toHaveBeenCalledWith({ layers: simulationLayers })

        // expect(testMapDThree.nodes).toEqual([])
    })
})