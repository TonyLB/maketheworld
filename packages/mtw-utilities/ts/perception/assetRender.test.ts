jest.mock('./dynamoDB')
import { getStateByAsset, getNormalForm } from './dynamoDB'

import { resultStateFactory } from '../executeCode/testAssets.js'
import { objectMap } from '../objects'

import { assetRender } from './assetRender'

const mockedGetStateByAsset = getStateByAsset as jest.Mock
const mockedGetNormalForm = getNormalForm as jest.Mock

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
        mockedGetStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({ ...previous, [asset]: testAssets[asset] || {} }), {})
        })
        mockedGetNormalForm.mockResolvedValue(normalForm)

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
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(['LayerA'], {})
    })

    it('should render with provided state and normal data', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {}) as Record<string, any>
        mockedGetStateByAsset.mockImplementation(async () => {
            return { LayerA: testAssets.LayerA }
        })
        mockedGetNormalForm.mockResolvedValue(normalForm)

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
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(['LayerA'], { LayerA: testAssets.LayerA })
        expect(mockedGetNormalForm).toHaveBeenCalledWith('LayerA', { LayerA: normalForm })
    })

    it('should correctly render (and not render) conditional rooms', async () => {
        const conditionalNormalForm = {
            Test: {
                key: 'LayerA',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: 'MNO',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    },
                    {
                        key: 'bar',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'Condition-1',
                        tag: 'Condition',
                        index: 0
                    }]
                }]
            },
            'MNO': {
                key: 'MNO',
                EphemeraId: 'ROOM#VORTEX',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: 'Vortex',
                    contents: []
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
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    contents: [{ key: 'QRS#MNO', tag: 'Exit', index: 0 }]
                }]
            },
            'Condition-0': {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'bar',
                dependencies: ['bar'],
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: [
                        { key: 'QRS', tag: 'Room', index: 0 }
                    ]
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
            'Condition-1': {
                key: 'Condition-1',
                tag: 'Condition',
                if: '!bar',
                dependencies: ['bar'],
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    contents: [
                        { key: 'TUV', tag: 'Room', index: 0 },
                        { key: 'MNO#QRS', tag: 'Exit', index: 0 }
                    ]
                }]
            },
            'TUV#MNO': {
                key: 'TUV#MNO',
                tag: 'Exit',
                to: 'MNO',
                toEphemeraId: 'VORTEX',
                from: 'TUV',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-1', tag: 'Condition', index: 0 }, { key: 'TUV', tag: 'Room', index: 0 }],
                    contents: []
                }]
            },
            'TUV': {
                key: 'TUV',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-1', tag: 'Condition', index: 0 }],
                    contents: [{ key: 'TUV#MNO', tag: 'Exit', index: 0 }]
                }]
            },
            'MNO#QRS': {
                key: 'TUV#MNO',
                tag: 'Exit',
                to: 'QRS',
                toEphemeraId: 'VORTEX',
                from: 'MNO',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: 'Condition-1', tag: 'Condition', index: 0 }],
                    contents: []
                }]
            }
        }
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetStateByAsset.mockImplementation(async () => {
            return { LayerA: testAssets.LayerA }
        })
        mockedGetNormalForm.mockResolvedValue(conditionalNormalForm)

        const output = await assetRender({
            assetId: 'LayerA',
            existingStatesByAsset: {
                LayerA: testAssets.LayerA
            },
            existingNormalFormsByAsset: { LayerA: conditionalNormalForm }
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
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(['LayerA'], { LayerA: testAssets.LayerA })
        expect(mockedGetNormalForm).toHaveBeenCalledWith('LayerA', { LayerA: conditionalNormalForm })
    })

    //
    // TODO: Create a test to confirm that conditional rooms and exits are correctly rendered both
    // when they fail and when they succeed
    //

})