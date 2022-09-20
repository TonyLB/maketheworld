import { jest, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('@tonylb/mtw-utilities/dist/executeCode/recalculateComputes')
import recalculateComputes from '@tonylb/mtw-utilities/dist/executeCode/recalculateComputes'
jest.mock('@tonylb/mtw-utilities/dist/computation/sandbox')
import { evaluateCode } from '@tonylb/mtw-utilities/dist/computation/sandbox'
jest.mock('@tonylb/mtw-utilities/dist/perception/assetRender')
import assetRender from '@tonylb/mtw-utilities/dist/perception/assetRender'
jest.mock('./perAsset')
import { mergeIntoEphemera } from './perAsset'

import { cacheAssetMessage } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { BaseAppearance, ComponentAppearance, NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

let mockTestAsset: NormalForm = {
    'Import-0': {
        tag: 'Import',
        from: 'BASE',
        key: 'Import-0',
        appearances: [{
            contents: [],
            contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
        }],
        mapping: {}
    },
    Test: {
        tag: 'Asset',
        key: 'Test',
        appearances: [{
            contents: [{
                tag: 'Import',
                key: 'Import-0',
                index: 0
            }],
            contextStack: []
        }]
    }
}
let mockNamespaceMap: Record<string, string> = {
    Test: 'ASSET#Test'
}

jest.mock('@tonylb/mtw-asset-workspace/dist/', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            get fileNameBase() {
                if (address.zone === 'Personal') {
                    return 'Personal/Test/Test'
                }
                else {
                    return 'Library/Test'
                }
            },
            loadJSON: jest.fn(),
            normal: mockTestAsset,
            namespaceIdToDB: mockNamespaceMap
        }
    })
})

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const evaluateCodeMock = evaluateCode as jest.Mock
const recalculateComputesMock = recalculateComputes as jest.Mock
const assetRenderMock = assetRender as jest.Mock
// const AssetWorkspaceMock = AssetWorkspace as jest.Mocked<typeof AssetWorkspace>

describe('cacheAsset', () => {
    const messageBusMock = { send: jest.fn() } as unknown as MessageBus
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        mockTestAsset = {
            'Import-0': {
                tag: 'Import',
                from: 'BASE',
                key: 'Import-0',
                appearances: [{
                    contents: [],
                    contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
                }],
                mapping: {}
            },
            Test: {
                tag: 'Asset',
                key: 'Test',
                appearances: [{
                    contents: [{
                        tag: 'Import',
                        key: 'Import-0',
                        index: 0
                    }],
                    contextStack: []
                }]
            }
        }
        mockNamespaceMap = {
            Test: 'ASSET#Test'
        }
    })

    it('should skip processing when check option and already present', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            EphemeraId: 'ASSET#Test'
        })
        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: { check: true }
            }],
            messageBus: messageBusMock
        })

        expect(mergeIntoEphemera).toHaveBeenCalledTimes(0)
        expect(recalculateComputes).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should skip processing when asset is an instanced story', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            EphemeraId: 'ASSET#Test'
        })
        mockTestAsset = {
            'Import-0': {
                tag: 'Import',
                from: 'BASE',
                key: 'Import-0',
                appearances: [{
                    contents: [],
                    contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
                }],
                mapping: {}
            },
            Test: {
                tag: 'Asset',
                key: 'Test',
                instance: true,
                appearances: [{
                    contents: [{
                        tag: 'Import',
                        key: 'Import-0',
                        index: 0
                    }],
                    contextStack: []
                }]
            }
        }
        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
    
        expect(mergeIntoEphemera).toHaveBeenCalledTimes(0)
        expect(recalculateComputes).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should send rooms in need of update', async () => {
        const topLevelAppearance: BaseAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        ephemeraDBMock.getItem
            .mockResolvedValueOnce({ State: {} })
        mockNamespaceMap = {
            test: 'ASSET#test',
            ABC: 'ROOM#DEF'
        }
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    },
                    {
                        key: 'powered',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'switchedOn',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'active',
                        tag: 'Computed',
                        index: 0
                    },
                    {
                        key: 'toggleSwitch',
                        tag: 'Action',
                        index: 0
                    }]
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    name: 'Vortex',
                    render: []
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    render: ['The lights are on '],
                    contents: []
                }] as ComponentAppearance[]
            },
            powered: {
                key: 'powered',
                tag: 'Variable',
                default: 'false',
                appearances: [topLevelAppearance]
            },
            switchedOn: {
                key: 'switchedOn',
                tag: 'Variable',
                default: 'true',
                appearances: [topLevelAppearance]
            },
            active: {
                key: 'active',
                tag: 'Computed',
                src: 'powered && switchedOn',
                dependencies: ['switchedOn', 'powered'],
                appearances: [topLevelAppearance]
            },
            toggleSwitch: {
                key: 'toggleSwitch',
                tag: 'Action',
                src: 'switchedOn = !switchedOn',
                appearances: [topLevelAppearance]
            },
            ['Condition-0']: {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'active',
                dependencies: ['active'],
                appearances: [{
                    ...topLevelAppearance,
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            }
        }
        recalculateComputesMock.mockReturnValue({ state: {
            active: {
                computed: true,
                key: 'active',
                src: 'powered && switchedOn',
            },
            powered: {
                value: true
            },
            switchedOn: {
                value: true
            }
        } })
        assetRenderMock.mockResolvedValue({ foo: 'bar' })

        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'test',
            [{
                EphemeraId: 'ROOM#DEF',
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    exits: [],
                    name: 'Vortex',
                    render: []
                },
                {
                    conditions: [{
                        dependencies: ["active"],
                        if: "active"
                    }],
                    exits: [],
                    name: '',
                    render: ["The lights are on "]
                }]
            }]
        )
        expect(recalculateComputes).toHaveBeenCalledWith(
            {
                active: {
                    computed: true,
                    key: 'active',
                    src: 'powered && switchedOn'
                },
                powered: {
                    computed: false,
                    key: 'powered',
                    value: true
                },
                switchedOn: {
                    computed: false,
                    key: 'switchedOn',
                    value: true
                }
            },
            {
                active: {
                    room: ['DEF']
                },
                powered: {
                    computed: ['active']
                },
                switchedOn: {
                    computed: ['active']
                }
            },
            ['powered', 'switchedOn']
        )
        const expectedState = {
            active: {
                computed: true,
                key: 'active',
                src: 'powered && switchedOn'
            },
            powered: {
                value: true
            },
            switchedOn: {
                value: true
            }
        }
        expect(assetRender).toHaveBeenCalledWith({
            assetId: 'test',
            existingNormalFormsByAsset: { test: mockTestAsset },
            existingStatesByAsset: { test: expectedState }
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            Actions: {
                toggleSwitch: {
                    src: 'switchedOn = !switchedOn'
                }
            },
            State: expectedState,
            Dependencies: {
                active: {
                    room: ['DEF']
                },
                powered: {
                    computed: ['active']
                },
                switchedOn: {
                    computed: ['active']
                }
            },
            mapCache: { foo: 'bar' },
            importTree: {},
            scopeMap: {
                test: 'ASSET#test',
                ABC: 'ROOM#DEF'
            }
        })
    })

})