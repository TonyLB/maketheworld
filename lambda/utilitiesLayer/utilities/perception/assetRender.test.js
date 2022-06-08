import { jest, describe, expect, it } from '@jest/globals'

jest.mock('./dynamoDB.js')
import { getCharacterAssets, getItemMeta, getStateByAsset, getGlobalAssets, getNormalForm } from './dynamoDB.js'

import { resultStateFactory, testMockImplementation } from '../executeCode/testAssets.js'

import { assetRender } from './assetRender.js'

describe('assetRender', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jest.restoreAllMocks()
    })

    const normalForm = {
        Test: {
            key: 'LayerA',
            tag: 'Asset',
            appearances: [{
                contextStack: [],
                contents: [{
                    key: 'Import-0',
                    tag: 'Import',
                    index: 0
                },
                {
                    key: 'MNO',
                    tag: 'Room',
                    index: 0
                },
                {
                    key: 'QRS',
                    tag: 'Room',
                    index: 0
                },
                {
                    key: 'TestMap',
                    tag: 'Map',
                    index: 0
                },
                {
                    key: 'clockTower',
                    tag: 'Feature',
                    index: 1
                },
                {
                    key: 'active',
                    tag: 'Variable',
                    index: 0
                },
                {
                    key: 'inactive',
                    tag: 'Computed',
                    index: 0
                },
                {
                    key: 'toggleActive',
                    tag: 'Action',
                    index: 0
                }]
            }]
        },
        'Import-0': {
            key: 'Import-0',
            tag: 'Import',
            from: 'BASE',
            mapping: {
                power: { key: 'foo', type: 'Variable' }
            },
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                contents: [{ key: 'power', tag: 'Variable', index: 0 }],
                props: {}
            }]
        },
        'power': {
            key: 'power',
            tag: 'Variable',
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Import-0', tag: 'Import', index: 0 }],
                contents: []
            }]
        },
        'MNO': {
            key: 'MNO',
            EphemeraId: 'ROOM#VORTEX',
            tag: 'Room',
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                name: 'Vortex',
                contents: [{
                    key: 'clockTower',
                    tag: 'Feature',
                    index: 0
                }]
            },
            {
                contextStack: [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'TestMap', tag: 'Map', index: 0 }
                ],
                contents: []
            }]
        },
        TestMap: {
            tag: 'Map',
            key: 'TestMap',
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                rooms: {
                    'MNO': {
                        x: 200,
                        y: 150
                    }
                },
                contents: [{
                    tag: 'Room',
                    key: 'MNO',
                    index: 1
                }]
            }]
        },
        'QRS#MNO': {
            key: 'QRS#MNO',
            tag: 'Exit',
            to: 'MNO',
            toEphemeraId: 'VORTEX',
            from: 'QRS',
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'QRS', tag: 'Room', index: 0 }],
                contents: []
            }]
        },
        'QRS': {
            key: 'QRS',
            EphemeraId: 'ROOM#QRS',
            tag: 'Room',
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                contents: [{ key: 'QRS#MNO', tag: 'Exit', index: 0 }]
            }]
        },
        clockTower: {
            key: 'clockTower',
            tag: 'Feature',
            name: 'Clock Tower',
            appearances: [{
                contextStack: [
                    { key: 'Test', tag: 'Asset', index: 0 },
                    { key: 'MNO', tag: 'Room', index: 0 }
                ],
                contents: []
            },
            {
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                contents: []
            }]
        },
        bar: {
            key: 'bar',
            tag: 'Variable',
            default: 'true',
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                contents: []
            }]
        },
        inactive: {
            key: 'fooBar',
            tag: 'Computed',
            src: 'foo && bar',
            dependencies: ['foo', 'bar'],
            appearances: [{
                contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                contents: []
            }]
        }
    }

    it('should render with no provided state and data', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {})
        getStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({ ...previous, [asset]: testAssets[asset] || {} }), {})
        })
        getNormalForm.mockResolvedValue(normalForm)

        const output = await assetRender({
            assetId: 'LayerA'
        })
        expect(output).toEqual({
            MNO: {
                EphemeraId: 'ROOM#VORTEX',
                name: ['Vortex'],
                exits: []
            },
            QRS: {
                EphemeraId: 'ROOM#QRS',
                name: [],
                exits: [{
                    key: 'QRS#MNO',
                    to: 'MNO',
                    toEphemeraId: 'VORTEX'
                }]
            }
        })
        expect(getStateByAsset).toHaveBeenCalledWith(['LayerA'], {})
    })

    it('should render with provided state and normal data', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {})
        getStateByAsset.mockImplementation(async () => {
            return { LayerA: testAssets.LayerA }
        })
        getNormalForm.mockResolvedValue(normalForm)

        const output = await assetRender({
            assetId: 'LayerA',
            existingStatesByAsset: {
                LayerA: testAssets.LayerA
            },
            existingNormalFormsByAsset: { LayerA: normalForm }
        })
        expect(output).toEqual({
            MNO: {
                EphemeraId: 'ROOM#VORTEX',
                name: ['Vortex'],
                exits: []
            },
            QRS: {
                EphemeraId: 'ROOM#QRS',
                name: [],
                exits: [{
                    key: 'QRS#MNO',
                    to: 'MNO',
                    toEphemeraId: 'VORTEX'
                }]
            }
        })
        expect(getStateByAsset).toHaveBeenCalledWith(['LayerA'], { LayerA: testAssets.LayerA })
        expect(getNormalForm).toHaveBeenCalledWith('LayerA', { LayerA: normalForm })
    })

    //
    // TODO: Create a test to confirm that conditional rooms and exits are correctly rendered both
    // when they fail and when they succeed
    //

})