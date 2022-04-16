import { jest, beforeEach, describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeStack.ts')
import MapDThreeStackRaw from './MapDThreeStack'
import { MapDThree } from '.'

import { mockClass } from '../../../../lib/jestHelpers'
const MapDThreeStack = mockClass(MapDThreeStackRaw)

describe('MapDThree', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should initialize stack on construction', () => {

        const testMapDThree = new MapDThree({ roomLayers: [{
            key: 'Two',
            rooms: {
                GHI: {
                    id: 'Two-A',
                    roomId: 'GHI',
                    x: 300,
                    y: 300
                }
            },
            roomVisibility: {
                GHI: true
            }
        },
        {
            key: 'One',
            rooms: {
                DEF: {
                    id: 'One-B',
                    roomId: 'DEF',
                    x: 300,
                    y: 200
                },
                ABC: {
                    id: 'One-A',
                    roomId: 'ABC',
                    x: 200,
                    y: 200
                }
            },
            roomVisibility: {
                DEF: true,
                ABC: true
            }
        }], exits: [] })
        expect(MapDThreeStack).toHaveBeenCalledTimes(2)
        expect(MapDThreeStack.mock.calls[0]).toEqual([{ layers: [] }])
        expect(MapDThreeStack.mock.calls[1]).toMatchSnapshot()

    })
})