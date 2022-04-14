import { jest, beforeEach, describe, it, expect } from '@jest/globals'
import { MapTree } from '../maps'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'
import { MapDThreeStack } from './MapDThreeStack'

import { mockFunction, mockClass } from '../../../../lib/jestHelpers'
const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

describe('MapDThreeStack', () => {
    const testLayers = [{
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

    let testMapDThreeStack = new MapDThreeStack({ layers: [] })
    let testLayerOne = new MapDThreeIterator('stub', [], [])
    let testLayerTwo = new MapDThreeIterator('stub', [], [])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        testMapDThreeStack = new MapDThreeStack({
            layers: testLayers
        })
        testLayerOne = testMapDThreeStack.layers[0]
        Object.defineProperty(testLayerOne, 'nodes', { get: jest.fn().mockReturnValue([{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true
        }]) })
        testLayerOne.key = 'Two'
        testLayerOne.simulation = { stop: jest.fn() } as any
        testLayerTwo = testMapDThreeStack.layers[1]
        Object.defineProperty(testLayerTwo, 'nodes', { get: jest.fn().mockReturnValue([{
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
        }]) })
        testLayerTwo.key = 'One'
    })

    it('should initialize layers on construction', () => {

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
    })

    it('should update correctly when node moved between layers', () => {
        testMapDThreeStack.update([{
            key: 'Two',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                x: 300,
                y: 300,
                visible: true,
                cascadeNode: false
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                x: 300,
                y: 200,
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
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
            }],
            links: []
        }])

        expect(testLayerOne.update).toHaveBeenCalledWith([{
            id: 'Two-A',
            roomId: 'GHI',
            x: 300,
            y: 300,
            visible: true,
            cascadeNode: false
        },
        {
            id: 'One-B',
            roomId: 'DEF',
            x: 300,
            y: 200,
            visible: true,
            cascadeNode: false
        }], [], false, expect.any(Function))

        expect(testLayerTwo.update).toHaveBeenCalledWith([{
                id: 'Two-A',
                roomId: 'GHI',
                fx: 300,
                x: 300,
                fy: 300,
                y: 300,
                visible: true,
                cascadeNode: true
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
            }], [], false, expect.any(Function))
    })

    it('should update correctly when layer removed', () => {
        testMapDThreeStack.update([{
            key: 'One',
            nodes: [{
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
            }],
            links: []
        }])

        expect(testLayerTwo.update).toHaveBeenCalledWith([{
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
            }], [], true, expect.any(Function))

        expect(testLayerOne.simulation.stop).toHaveBeenCalledTimes(1)
        expect(testMapDThreeStack.layers.length).toEqual(1)
    })

})