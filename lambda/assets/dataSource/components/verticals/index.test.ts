import type { DiagnosticsComponentVerticalMisalignedFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { componentVerticalsDataSource } from './index'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

const minimalRoomNdjson = (params: {
    universalKey: string
    dataCategory: string
    from?: string
}) => ({
    AssetId: params.universalKey,
    DataCategory: params.dataCategory,
    key: 'r1',
    universalKey: params.universalKey,
    tag: 'Room' as const,
    shortName: 'Room',
    exits: [] as { reference: { tag: 'Room'; key: string }; payload: string }[],
    examples: [{ key: 'base', tag: 'Example' as const }],
    ...(params.from ? { from: params.from } : {}),
})

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        putItem: jest.fn(),
        getItem: jest.fn(),
        query: jest.fn(),
        deleteItem: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: { send: jest.fn() },
}))

jest.mock('../../../clients', () => ({
    snsClient: { send: jest.fn() },
    sfnClient: { send: jest.fn() },
}))

jest.mock('../../../messageBus', () => ({
    default: {
        send: jest.fn(),
        subscribe: jest.fn(),
    },
    send: jest.fn(),
    subscribe: jest.fn(),
}))

jest.mock('./exhaustivePartitionLoader', () => {
    const { authoritativeComponentDataFromUniversalPartitionRows } =
        require('@tonylb/mtw-gateways/ts/assets/components/componentData')
    const { assetDB } = require('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        exhaustivePartitionLoader: {
            get: async (componentIds: string[]) =>
                Promise.all(
                    componentIds.map(async (componentId: string) => {
                        const ndjsonLines =
                            (await assetDB.query({
                                Key: { AssetId: componentId },
                                allFields: true,
                            })) || []
                        return authoritativeComponentDataFromUniversalPartitionRows(componentId, ndjsonLines)
                    })
                ),
        },
        invalidateExhaustivePartitionCache: jest.fn(),
    }
})

jest.mock('../../../internalCache', () => {
    const { queryImportVerticalMeta } =
        require('@tonylb/mtw-gateways/ts/assets/components/verticals')
    const { assetDB } = require('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        __esModule: true,
        default: {
            ComponentVerticals: {
                invalidate: jest.fn(),
                get: async (universalKeys: string[]) =>
                    Promise.all(
                        universalKeys.map(async (universalKey: string) => ({
                            universalKey,
                            hops: await queryImportVerticalMeta(assetDB, universalKey),
                        }))
                    ),
            },
        },
    }
})

jest.mock('./healComponentVertical', () => ({
    healComponentVertical: jest.fn(async () => ({
        assetId: 'ASSET#healed',
        universalKeysProcessed: 1,
    })),
}))

import { healComponentVertical } from './healComponentVertical'

const assetDBMock = jest.mocked(assetDB, { shallow: false })

describe('ComponentVerticalsDataSource (mtw.assets.components.verticals)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        assetDBMock.query.mockResolvedValue([] as any)
        assetDBMock.putItem.mockResolvedValue(undefined as any)
        assetDBMock.deleteItem.mockResolvedValue(undefined as any)
    })

    describe('Constructor', () => {
        it('should create instance with correct configuration', () => {
            expect(componentVerticalsDataSource.dataSourceKey).toBe('mtw.assets.components.verticals')
            expect(componentVerticalsDataSource.replayable).toBe(false)
            expect(componentVerticalsDataSource.primaryKeyName).toBe('AssetId')
        })
    })

    describe('Event subscription guards', () => {
        it('accepts Component Updated from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Updated',
                },
                getContent: () => Promise.resolve({ component: {} }),
            }
            expect(componentVerticalsDataSource.subscribedEventTypeGuard?.(envelope)).toBe(true)
        })

        it('rejects foreign dataSourceKey', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Updated',
                },
                getContent: () => Promise.resolve({}),
            }
            expect(componentVerticalsDataSource.subscribedEventTypeGuard?.(envelope)).toBe(false)
        })

        it('accepts Component Vertical Misaligned Finding from mtw.diagnostics', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'Component Vertical Misaligned Finding',
                },
                getContent: () =>
                    Promise.resolve({
                        type: 'Component Vertical Misaligned Finding',
                        assetId: 'ASSET#a',
                        status: 'missing',
                        diagnosticRunId: 'run-1',
                        timestamp: '2025-05-10T00:00:00.000Z',
                    } satisfies DiagnosticsComponentVerticalMisalignedFindingEvent),
            }
            expect(componentVerticalsDataSource.subscribedEventTypeGuard?.(envelope)).toBe(true)
        })
    })

    describe('receiveEvents projector', () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const streamEnvelope = jest.fn().mockResolvedValue(undefined)

        it('writes Meta::Import hop when Component Updated has _from and no prior row', async () => {
            assetDBMock.query.mockResolvedValue([
                minimalRoomNdjson({
                    universalKey: 'ROOM#r1',
                    dataCategory: 'ASSET#childB',
                    from: 'ASSET#parentA',
                }),
            ] as any)
            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#r1',
            } as any).withImport('ASSET#parentA' as any)

            await componentVerticalsDataSource.receiveEvents?.({
                events: [
                    {
                        header: {
                            dataSourceKey: 'mtw.assets',
                            streamKey: 'ASSET#childB',
                            timestamp: 1,
                            type: 'Component Updated',
                        },
                        getContent: () => Promise.resolve({ component: room }),
                    },
                ],
                streamEvent,
                streamEnvelope,
            })

            expect(assetDBMock.query).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: { AssetId: 'ROOM#r1' },
                    allFields: true,
                })
            )
            expect(assetDBMock.deleteItem).not.toHaveBeenCalled()
            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ROOM#r1',
                DataCategory: 'Meta::Import::parentA::childB',
            })
        })

        it('deletes prior hop and writes new parent when import parent changes', async () => {
            assetDBMock.query.mockResolvedValue([
                minimalRoomNdjson({
                    universalKey: 'ROOM#r1',
                    dataCategory: 'ASSET#childB',
                    from: 'ASSET#newPar',
                }),
                {
                    AssetId: 'ROOM#r1',
                    DataCategory: 'Meta::Import::oldPar::childB',
                },
            ] as any)

            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#r1',
            } as any).withImport('ASSET#newPar' as any)

            await componentVerticalsDataSource.receiveEvents?.({
                events: [
                    {
                        header: {
                            dataSourceKey: 'mtw.assets',
                            streamKey: 'ASSET#childB',
                            timestamp: 1,
                            type: 'Component Updated',
                        },
                        getContent: () => Promise.resolve({ component: room }),
                    },
                ],
                streamEvent,
                streamEnvelope,
            })

            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'ROOM#r1',
                DataCategory: 'Meta::Import::oldPar::childB',
            })
            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ROOM#r1',
                DataCategory: 'Meta::Import::newPar::childB',
            })
        })

        it('Component Removed deletes hop and does not put', async () => {
            assetDBMock.query.mockResolvedValue([
                {
                    AssetId: 'ROOM#r1',
                    DataCategory: 'Meta::Import::parentA::childB',
                },
            ] as any)

            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#r1',
            } as any)

            await componentVerticalsDataSource.receiveEvents?.({
                events: [
                    {
                        header: {
                            dataSourceKey: 'mtw.assets',
                            streamKey: 'ASSET#childB',
                            timestamp: 1,
                            type: 'Component Removed',
                        },
                        getContent: () => Promise.resolve({ component: room }),
                    },
                ],
                streamEvent,
                streamEnvelope,
            })

            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'ROOM#r1',
                DataCategory: 'Meta::Import::parentA::childB',
            })
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
        })

        it('clears import by deleting hop when Updated has no _from', async () => {
            assetDBMock.query.mockResolvedValue([
                minimalRoomNdjson({
                    universalKey: 'ROOM#r1',
                    dataCategory: 'ASSET#childB',
                }),
                {
                    AssetId: 'ROOM#r1',
                    DataCategory: 'Meta::Import::parentA::childB',
                },
            ] as any)

            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#r1',
            } as any)

            await componentVerticalsDataSource.receiveEvents?.({
                events: [
                    {
                        header: {
                            dataSourceKey: 'mtw.assets',
                            streamKey: 'ASSET#childB',
                            timestamp: 1,
                            type: 'Component Updated',
                        },
                        getContent: () => Promise.resolve({ component: room }),
                    },
                ],
                streamEvent,
                streamEnvelope,
            })

            expect(assetDBMock.deleteItem).toHaveBeenCalled()
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
        })

        it('Component Republished writes hop like Updated', async () => {
            assetDBMock.query.mockResolvedValue([
                minimalRoomNdjson({
                    universalKey: 'ROOM#r1',
                    dataCategory: 'ASSET#childB',
                    from: 'ASSET#parentA',
                }),
            ] as any)
            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#r1',
            } as any).withImport('ASSET#parentA' as any)

            await componentVerticalsDataSource.receiveEvents?.({
                events: [
                    {
                        header: {
                            dataSourceKey: 'mtw.assets',
                            streamKey: 'ASSET#childB',
                            timestamp: 1,
                            type: 'Component Republished',
                        },
                        getContent: () => Promise.resolve({ component: room }),
                    },
                ],
                streamEvent,
                streamEnvelope,
            })

            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ROOM#r1',
                DataCategory: 'Meta::Import::parentA::childB',
            })
        })

        it('runs healComponentVertical when diagnostics emits Component Vertical Misaligned Finding', async () => {
            jest.mocked(healComponentVertical).mockClear()
            await componentVerticalsDataSource.receiveEvents?.({
                events: [
                    {
                        header: {
                            dataSourceKey: 'mtw.diagnostics',
                            streamKey: 'global',
                            timestamp: 1,
                            type: 'Component Vertical Misaligned Finding',
                        },
                        getContent: () =>
                            Promise.resolve({
                                type: 'Component Vertical Misaligned Finding',
                                assetId: 'ASSET#childB',
                                status: 'missing',
                                diagnosticRunId: 'run-diag',
                                timestamp: '2025-05-10T00:00:00.000Z',
                            } satisfies DiagnosticsComponentVerticalMisalignedFindingEvent),
                    },
                ],
                streamEvent,
                streamEnvelope,
            })

            expect(healComponentVertical).toHaveBeenCalledWith({ assetId: 'ASSET#childB' })
            expect(assetDBMock.query).not.toHaveBeenCalled()
        })

        it('skips Dynamo when universalKey is missing', async () => {
            const room = new StandardRoom({
                tag: 'Room',
            } as any)

            await componentVerticalsDataSource.receiveEvents?.({
                events: [
                    {
                        header: {
                            dataSourceKey: 'mtw.assets',
                            streamKey: 'ASSET#childB',
                            timestamp: 1,
                            type: 'Component Updated',
                        },
                        getContent: () => Promise.resolve({ component: room }),
                    },
                ],
                streamEvent,
                streamEnvelope,
            })

            expect(assetDBMock.query).not.toHaveBeenCalled()
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
        })
    })
})
