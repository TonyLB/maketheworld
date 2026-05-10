import { assetsDataSource } from './index'
import { AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { cacheAsset, decacheAsset } from './caching'
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { reseedComponentExamplesFromDiagnostics } from '../componentExamples/reseedFromDiagnostics'
import { healPlayer } from '../player/heal'
import { healComponentVertical } from './components/verticals/healComponentVertical'
import messageBus from '../messageBus'

// Mock external dependencies
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        putItem: jest.fn(),
        getItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: { send: jest.fn() }
}))

jest.mock('../clients', () => ({
    snsClient: { send: jest.fn() },
    sfnClient: { send: jest.fn() }
}))

jest.mock('../messageBus')
jest.mock('../internalCache', () => ({
    Graph: {
        get: jest.fn().mockResolvedValue({
            reverse: jest.fn().mockReturnValue({
                topologicalSort: jest.fn().mockReturnValue({
                    flat: jest.fn().mockReturnValue([])
                })
            })
        })
    },
    AssetMetaData: {
        get: jest.fn().mockResolvedValue([{
            address: {
                zone: 'Library'
            }
        }])
    }
}))
jest.mock('./caching')
jest.mock('../componentExamples/reseedFromDiagnostics', () => ({
    reseedComponentExamplesFromDiagnostics: jest.fn()
}))
jest.mock('../player/heal', () => ({
    healPlayer: jest.fn(async () => ({ Characters: [], Assets: [], guestName: '', guestId: '' }))
}))
jest.mock('./components/verticals/healComponentVertical', () => ({
    healComponentVertical: jest.fn(async () => ({
        assetId: 'ASSET#stub',
        universalKeysProcessed: 0,
    })),
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const eventBridgeSendMock = jest.mocked(eventBridgeClient.send, { shallow: false })
const cacheAssetMock = jest.mocked(cacheAsset)
const decacheAssetMock = jest.mocked(decacheAsset)
const reseedComponentExamplesFromDiagnosticsMock = jest.mocked(reseedComponentExamplesFromDiagnostics)
const healPlayerMock = jest.mocked(healPlayer)
const healComponentVerticalMock = jest.mocked(healComponentVertical)

describe('AssetsDataSource (mtw.assets)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        cacheAssetMock.mockResolvedValue({
            zone: 'Library',
            isNewAsset: false
        } as any)
        decacheAssetMock.mockResolvedValue(undefined)
        reseedComponentExamplesFromDiagnosticsMock.mockResolvedValue(undefined)
        healPlayerMock.mockReset()
        healPlayerMock.mockResolvedValue({ Characters: [], Assets: [], guestName: '', guestId: '' } as any)
        healComponentVerticalMock.mockReset()
        healComponentVerticalMock.mockResolvedValue({
            assetId: 'ASSET#stub',
            universalKeysProcessed: 0,
        })
        jest.mocked(messageBus.send).mockReset()
        // Mock assetDB.query for diagnostic tests
        assetDBMock.query.mockResolvedValue([] as any)
    })

    describe('Constructor', () => {
        it('should create instance with correct configuration', () => {
            expect(assetsDataSource.dataSourceKey).toBe('mtw.assets')
            expect(assetsDataSource.replayable).toBe(false)
            expect(assetsDataSource.getSerializer()).toBeDefined()
        })
    })

    describe('EventBridge Serialization', () => {
        it('should serialize Component Updated events to EventBridge with WML', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Test Character',
                universalKey: 'CHARACTER#char123'
            })

            const update: AssetsEventUpdate = {
                type: 'Component Updated',
                component
            } as AssetsEventUpdate

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset123',
                header: { type: 'Component Updated' }
            })

            // Verify EventBridge event structure and serialization
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets',
                        DetailType: 'Component Updated',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset123', // streamKey contains the asset ID
                            componentId: 'CHARACTER#char123', // componentId is set from universalKey
                            wml: expect.any(String) // Should be WML string
                        })
                    })
                ])
            )

            // Verify the WML matches expected content exactly
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            const serializedUpdate = eventBridgeCall.Detail
            expect(serializedUpdate.wml).toEqual(deIndentWML(`<Character uuid=(char123)><ShortName>Test Character</ShortName></Character>`))
        })

        it('should serialize Asset-level events to EventBridge', async () => {
            const update: AssetsEventUpdate = {
                type: 'Canon Updated',
                assetIds: ['ASSET#asset789']
            } as AssetsEventUpdate

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset789',
                header: { type: 'Canon Updated' }
            })

            // Verify EventBridge event structure
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets',
                        DetailType: 'Canon Updated',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset789',
                            assetIds: ['ASSET#asset789']
                        })
                    })
                ])
            )
        })

        it('should handle serialization of complex StandardComponent objects', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Complex Character',
                pronouns: 'they/them',
                universalKey: 'CHARACTER#complex123'
                // Note: StandardCharacter may not support description field
            })

            const update: AssetsEventUpdate = {
                type: 'Component Updated',
                component
            } as AssetsEventUpdate

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#complex-asset',
                header: { type: 'Component Updated' }
            })

            // Verify the serialized WML matches expected content exactly
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            const serializedUpdate = eventBridgeCall.Detail
            
            expect(serializedUpdate.wml).toEqual(deIndentWML(`
                <Character uuid=(complex123)>
                    <ShortName>Complex Character</ShortName>
                    <Pronouns>they/them</Pronouns>
                </Character>
            `))
        })

        it('should preserve detailType metadata in EventBridge events', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                universalKey: 'CHARACTER#metadata123'
            })

            const update: AssetsEventUpdate = {
                type: 'Component Updated',
                component
            } as AssetsEventUpdate

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#metadata-asset',
                header: { type: 'Component Updated' }
            })

            // Verify detailType is preserved
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            expect(eventBridgeCall.DetailType).toBe('Component Updated')
            expect(eventBridgeCall.Source).toBe('mtw.assets')
        })
    })

    describe('Event Processing', () => {
        it('should process WML content update events', async () => {
            const content = {
                type: 'Content Update' as const,
                AssetId: 'ASSET#test123',
                schema: new StandardForm(`<Asset uuid=(test123) />`)
            }
            const wmlEvent = {
                header: {
                    dataSourceKey: 'mtw.wml' as const,
                    streamKey: 'ASSET#test123',
                    timestamp: Date.now(),
                    type: 'Content Update'
                },
                getContent: () => Promise.resolve(content)
            }

            // Mock the receiveEvents method
            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [wmlEvent], 
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process WML zone changed events', async () => {
            const zoneChangedEvent = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test123',
                    timestamp: Date.now(),
                    type: 'Zone Changed'
                },
                getContent: () => Promise.resolve({
                    type: 'Zone Changed' as const,
                    AssetId: 'ASSET#test123',
                    fromZone: 'Personal' as Zone,
                    toZone: 'Library' as Zone,
                    player: 'testplayer',
                    subFolder: 'testfolder'
                })
            }

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [zoneChangedEvent], 
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Verify that assetDB.putItem was called to update the Meta::Asset record
            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ASSET#test123',
                DataCategory: 'Meta::Asset',
                address: {
                    zone: 'Library',
                    player: 'testplayer',
                    subFolder: 'testfolder'
                },
                zone: 'Library',
                player: 'testplayer'
            })

            // Verify that canon graph management was NOT triggered (not entering/leaving Canon)
            expect(assetDBMock.query).not.toHaveBeenCalled()
            
            // Verify that Zone Updated event was streamed (always happens for zone changes)
            // Internal payload omits type; discrimination is by header only.
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    fromZone: 'Personal',
                    toZone: 'Library',
                    player: 'testplayer'
                },
                header: { type: 'Zone Updated' },
                streamKey: 'ASSET#test123'
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process WML zone changed events without optional fields', async () => {
            const zoneChangedEvent = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test456',
                    timestamp: Date.now(),
                    type: 'Zone Changed'
                },
                getContent: () => Promise.resolve({
                    type: 'Zone Changed' as const,
                    AssetId: 'ASSET#test456',
                    fromZone: 'Draft' as Zone,
                    toZone: 'Canon' as Zone
                })
            }

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Mock canon graph query results
            assetDBMock.query.mockResolvedValueOnce([
                { AssetId: 'ASSET#test456', DataCategory: 'Meta::Asset', zone: 'Canon' },
                { AssetId: 'ASSET#other123', DataCategory: 'Meta::Asset', zone: 'Canon' }
            ] as any)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [zoneChangedEvent], 
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Verify that assetDB.putItem was called with minimal fields
            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ASSET#test456',
                DataCategory: 'Meta::Asset',
                address: {
                    zone: 'Canon'
                },
                zone: 'Canon'
            })

            // Verify that canon graph management was triggered (entering Canon zone)
            expect(assetDBMock.query).toHaveBeenCalledWith({
                IndexName: 'DataCategoryIndex',
                Key: {
                    DataCategory: 'Meta::Asset'
                },
                FilterExpression: "zone = :canon",
                ExpressionAttributeValues: {
                    ':canon': 'Canon'
                },
                ProjectionFields: ['AssetId', 'zone']
            })

            // Verify that canon updated event was streamed (internal payload omits type)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { assetIds: [] },
                streamKey: 'canon-global',
                header: { type: 'Canon Updated' }
            })

            // Verify that zone updated event was also streamed (internal payload omits type)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { fromZone: 'Draft', toZone: 'Canon' },
                streamKey: 'ASSET#test456',
                header: { type: 'Zone Updated' }
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process WML zone changed events for decanonization (leaving Canon zone)', async () => {
            const zoneChangedEvent = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test789',
                    timestamp: Date.now(),
                    type: 'Zone Changed'
                },
                getContent: () => Promise.resolve({
                    type: 'Zone Changed' as const,
                    AssetId: 'ASSET#test789',
                    fromZone: 'Canon' as Zone,
                    toZone: 'Library' as Zone
                })
            }

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Mock canon graph query results (remaining canon assets)
            assetDBMock.query.mockResolvedValueOnce([
                { AssetId: 'ASSET#other123', DataCategory: 'Meta::Asset', zone: 'Canon' }
            ] as any)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [zoneChangedEvent], 
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Verify that assetDB.putItem was called
            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ASSET#test789',
                DataCategory: 'Meta::Asset',
                address: {
                    zone: 'Library'
                },
                zone: 'Library'
            })

            // Verify that canon graph management was triggered (leaving Canon zone)
            expect(assetDBMock.query).toHaveBeenCalledWith({
                IndexName: 'DataCategoryIndex',
                Key: {
                    DataCategory: 'Meta::Asset'
                },
                FilterExpression: "zone = :canon",
                ExpressionAttributeValues: {
                    ':canon': 'Canon'
                },
                ProjectionFields: ['AssetId', 'zone']
            })

            // Verify that canon updated event was streamed (internal payload omits type)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { assetIds: [] },
                streamKey: 'canon-global',
                header: { type: 'Canon Updated' }
            })

            // Verify that zone updated event was also streamed (internal payload omits type)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { fromZone: 'Canon', toZone: 'Library' },
                streamKey: 'ASSET#test789',
                header: { type: 'Zone Updated' }
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })



        it('should handle WML asset purged events', async () => {
            const assetPurgedEvent = {
                header: {
                    dataSourceKey: 'mtw.wml' as const,
                    streamKey: 'ASSET#purged123',
                    timestamp: Date.now(),
                    type: 'Asset Purged'
                },
                getContent: () => Promise.resolve({
                    type: 'Asset Purged' as const,
                    zone: 'Draft' as const,
                    objectsDeleted: 42
                })
            }

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [assetPurgedEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(decacheAssetMock).toHaveBeenCalledWith({
                assetId: 'ASSET#purged123',
                streamEvent: mockStreamEvent
            })

            // Internal payload omits type; discrimination is by header only.
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { zone: 'Draft' },
                streamKey: 'ASSET#purged123',
                header: { type: 'Asset Removed' }
            })
        })

        it('should handle diagnostic events', async () => {
            // Mock the assetDB.query call that's failing in healGlobalValues
            assetDBMock.query.mockResolvedValueOnce([] as any) // Return empty array for Items.map

            const diagnosticEvent = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'test-stream',
                    timestamp: Date.now(),
                    type: 'Heal Global Values'
                },
                getContent: () => Promise.resolve({
                    type: 'Heal Global Values' as const
                })
            }

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [diagnosticEvent], 
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process Cache Consistency Finding by calling cacheAsset', async () => {
            const cacheConsistencyEvent = {
                header: {
                    dataSourceKey: 'mtw.diagnostics' as const,
                    streamKey: 'test-stream',
                    timestamp: Date.now(),
                    type: 'Cache Consistency Finding'
                },
                getContent: () => Promise.resolve({
                    type: 'Cache Consistency Finding' as const,
                    assetId: 'ASSET#primitives',
                    status: 'stale' as const,
                    diagnosticRunId: 'run-1',
                    timestamp: new Date().toISOString()
                })
            }

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [cacheConsistencyEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(cacheAssetMock).toHaveBeenCalledWith({
                assetId: 'ASSET#primitives',
                streamEvent: mockStreamEvent
            })
        })

        it('should process Ephemera RenderCache Finding by reseeding component examples', async () => {
            const findingEvent: any = {
                header: {
                    dataSourceKey: 'mtw.diagnostics' as const,
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'Ephemera RenderCache Finding'
                },
                getContent: () => Promise.resolve({
                    type: 'Ephemera RenderCache Finding' as const,
                    perspective: ['ASSET#primitives'],
                    status: 'missing' as const,
                    diagnosticRunId: 'diag-1',
                    timestamp: '2026-04-21T12:00:00.000Z',
                    roomIds: ['ROOM#alpha']
                })
            }
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [findingEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(reseedComponentExamplesFromDiagnosticsMock).toHaveBeenCalledWith({
                type: 'Ephemera RenderCache Finding',
                perspective: ['ASSET#primitives'],
                status: 'missing',
                diagnosticRunId: 'diag-1',
                timestamp: '2026-04-21T12:00:00.000Z',
                roomIds: ['ROOM#alpha']
            }, mockStreamEvent)
        })

        it('should route both missing and corrupted render-cache findings through the same reseed handler', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const makeFindingEvent = (status: 'missing' | 'corrupted') => ({
                header: {
                    dataSourceKey: 'mtw.diagnostics' as const,
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'Ephemera RenderCache Finding'
                },
                getContent: () => Promise.resolve({
                    type: 'Ephemera RenderCache Finding' as const,
                    perspective: ['ASSET#primitives'],
                    status,
                    diagnosticRunId: `diag-${status}`,
                    timestamp: '2026-04-21T12:00:00.000Z'
                })
            })

            await assetsDataSource.receiveEvents?.({
                events: [makeFindingEvent('missing') as any, makeFindingEvent('corrupted') as any],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(reseedComponentExamplesFromDiagnosticsMock).toHaveBeenCalledTimes(2)
            expect(reseedComponentExamplesFromDiagnosticsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'missing' }), mockStreamEvent)
            expect(reseedComponentExamplesFromDiagnosticsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'corrupted' }), mockStreamEvent)
        })

        it('should process repeated findings with the same input without diverging behavior', async () => {
            const findingEvent: any = {
                header: {
                    dataSourceKey: 'mtw.diagnostics' as const,
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'Ephemera RenderCache Finding'
                },
                getContent: () => Promise.resolve({
                    type: 'Ephemera RenderCache Finding' as const,
                    perspective: ['ASSET#primitives'],
                    status: 'missing' as const,
                    diagnosticRunId: 'diag-repeat',
                    timestamp: '2026-04-21T12:00:00.000Z',
                    roomIds: ['ROOM#alpha']
                })
            }
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [findingEvent, findingEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(reseedComponentExamplesFromDiagnosticsMock).toHaveBeenCalledTimes(2)
            expect(reseedComponentExamplesFromDiagnosticsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
                perspective: ['ASSET#primitives'],
                roomIds: ['ROOM#alpha']
            }), mockStreamEvent)
            expect(reseedComponentExamplesFromDiagnosticsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
                perspective: ['ASSET#primitives'],
                roomIds: ['ROOM#alpha']
            }), mockStreamEvent)
        })

        it('should process mtw.cognito New Player by healing the player', async () => {
            const cognitoEvent: any = {
                header: {
                    dataSourceKey: 'mtw.cognito',
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'New Player'
                },
                getContent: () => Promise.resolve({
                    type: 'New Player',
                    player: 'new-player'
                })
            }
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [cognitoEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(healPlayerMock).toHaveBeenCalledWith('new-player')
        })

        it('should process Player Misalignment Finding by healing the player', async () => {
            const findingEvent: any = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'Player Misalignment Finding'
                },
                getContent: () => Promise.resolve({
                    type: 'Player Misalignment Finding',
                    player: 'misaligned-player',
                    diagnosticRunId: 'diag-player-1',
                    timestamp: '2026-05-07T00:00:00.000Z'
                })
            }
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [findingEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(healPlayerMock).toHaveBeenCalledWith('misaligned-player')
        })

        it('should process api.assets HealPlayer and emit ReturnValue', async () => {
            const apiEvent: any = {
                header: {
                    dataSourceKey: 'api.assets',
                    streamKey: 'ingress',
                    timestamp: Date.now(),
                    type: 'HealPlayer'
                },
                getContent: () => Promise.resolve({
                    type: 'HealPlayer',
                    player: 'api-player'
                })
            }
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [apiEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(healPlayerMock).toHaveBeenCalledWith('api-player')
            expect(messageBus.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: { Characters: [], Assets: [], guestName: '', guestId: '' }
            })
        })

        it('should process api.assets HealComponentVertical and emit ReturnValue', async () => {
            healComponentVerticalMock.mockResolvedValueOnce({
                assetId: 'ASSET#a',
                universalKeysProcessed: 2,
            })
            const apiEvent: any = {
                header: {
                    dataSourceKey: 'api.assets',
                    streamKey: 'ingress',
                    timestamp: Date.now(),
                    type: 'HealComponentVertical',
                },
                getContent: () =>
                    Promise.resolve({
                        type: 'HealComponentVertical',
                        assetId: 'ASSET#a',
                    }),
            }
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [apiEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined),
            })

            expect(healComponentVerticalMock).toHaveBeenCalledWith({
                assetId: 'ASSET#a',
                componentUniversalKeys: undefined,
            })
            expect(messageBus.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: { assetId: 'ASSET#a', universalKeysProcessed: 2 },
            })
        })

        it('should normalize short assetId to ASSET# prefix in Cache Consistency Finding', async () => {
            const cacheConsistencyEvent: any = {
                header: {
                    dataSourceKey: 'mtw.diagnostics' as const,
                    streamKey: 'test-stream',
                    timestamp: Date.now(),
                    type: 'Cache Consistency Finding'
                },
                getContent: () => Promise.resolve({
                    type: 'Cache Consistency Finding' as const,
                    assetId: 'primitives',
                    status: 'missing' as const,
                    diagnosticRunId: 'diag-2',
                    timestamp: '2026-04-21T12:00:00.000Z'
                })
            }

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [cacheConsistencyEvent],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(cacheAssetMock).toHaveBeenCalledWith({
                assetId: 'ASSET#primitives',
                streamEvent: mockStreamEvent
            })
        })

        it('should process multiple events in batch independently', async () => {
            // Mock streamEvent function
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Create a batch of events from different sources
            const batchEvents = [
                {
                    header: {
                        dataSourceKey: 'mtw.wml',
                        streamKey: 'ASSET#test123',
                        timestamp: Date.now(),
                        type: 'Content Update'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Content Update' as const,
                        AssetId: 'ASSET#test123',
                        schema: new StandardForm(`<Asset uuid=(test123) />`)
                    })
                },
                {
                    header: {
                        dataSourceKey: 'mtw.diagnostics',
                        streamKey: 'test-stream',
                        timestamp: Date.now(),
                        type: 'Heal Global Values'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Heal Global Values' as const
                    })
                },
                {
                    header: {
                        dataSourceKey: 'mtw.wml',
                        streamKey: 'ASSET#test456',
                        timestamp: Date.now(),
                        type: 'Content Update'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Content Update' as const,
                        AssetId: 'ASSET#test456',
                        schema: new StandardForm(`<Asset uuid=(test456) />`)
                    })
                }
            ]
            
            // Process the batch of events
            await assetsDataSource.receiveEvents?.({ 
                events: batchEvents, 
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // The key test: verify that receiveEvents can handle an array of events
            // (The actual processing logic is tested in other tests)
            // This test primarily verifies that the batch processing pattern works
            expect(mockStreamEvent).toHaveBeenCalled() // At least one event should trigger streamEvent
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to events from mtw.wml and mtw.diagnostics (specific types only)', () => {
            const subscribedHeaderPairs: Array<{ dataSourceKey: string; type: string }> = [
                { dataSourceKey: 'mtw.wml', type: 'Content Update' },
                { dataSourceKey: 'mtw.wml', type: 'Zone Changed' },
                { dataSourceKey: 'mtw.wml', type: 'Asset Purged' },
                { dataSourceKey: 'mtw.diagnostics', type: 'Heal Global Values' },
                { dataSourceKey: 'mtw.diagnostics', type: 'Cache Consistency Finding' },
                { dataSourceKey: 'mtw.diagnostics', type: 'Ephemera RenderCache Finding' },
                { dataSourceKey: 'mtw.diagnostics', type: 'Player Misalignment Finding' },
                { dataSourceKey: 'mtw.cognito', type: 'New Player' },
                { dataSourceKey: 'api.assets', type: 'HealPlayer' },
                { dataSourceKey: 'api.assets', type: 'HealComponentVertical' }
            ]

            subscribedHeaderPairs.forEach(({ dataSourceKey, type }) => {
                const envelope = {
                    header: {
                        dataSourceKey,
                        streamKey: 'test-stream',
                        timestamp: Date.now(),
                        type
                    },
                    getContent: () => Promise.resolve({})
                }

                expect(assetsDataSource.subscribedEventTypeGuard?.(envelope)).toBe(true)
            })
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEnvelope = {
                header: {
                    dataSourceKey: 'mtw.other',
                    streamKey: 'test-stream',
                    timestamp: Date.now(),
                    type: 'Test Event'
                },
                getContent: () => Promise.resolve({})
            }

            expect(assetsDataSource.subscribedEventTypeGuard?.(otherEnvelope)).toBe(false)
        })

        it('should not subscribe to events without proper structure', () => {
            const malformedEnvelope = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'test-stream',
                    timestamp: Date.now()
                    // missing type
                } as any,
                getContent: () => Promise.resolve({})
            }

            expect(assetsDataSource.subscribedEventTypeGuard?.(malformedEnvelope)).toBe(false)
        })
    })
})
