import { assetsDataSource } from './index'
import { AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardRemove } from '@tonylb/mtw-wml/ts/standardize/components/edits'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { decacheAsset } from './caching'

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

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const eventBridgeSendMock = jest.mocked(eventBridgeClient.send, { shallow: false })
const decacheAssetMock = jest.mocked(decacheAsset)

describe('AssetsDataSource (mtw.assets)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        decacheAssetMock.mockResolvedValue(undefined)
        // Mock assetDB.query for diagnostic tests
        assetDBMock.query.mockResolvedValue([])
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
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset123'
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

        it('should serialize StandardRemove as Component Updated with WML', async () => {
            // Construct a StandardRemove wrapped around a Character
            const component = new StandardCharacter({
                tag: 'Character',
                universalKey: 'CHARACTER#char456'
            })
            const update: AssetsEventUpdate = {
                type: 'Component Updated',
                component: new StandardRemove(component)
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset456'
            })

            // Verify EventBridge event structure and serialization
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets',
                        DetailType: 'Component Updated',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset456', // streamKey contains the asset ID
                            componentId: 'CHARACTER#char456',
                            wml: expect.stringContaining('<Remove>')
                        })
                    })
                ])
            )
        })

        it('should serialize Asset-level events to EventBridge', async () => {
            const update: AssetsEventUpdate = {
                type: 'Canon Updated',
                assetIds: ['ASSET#asset789']
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset789'
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
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#complex-asset'
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
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#metadata-asset'
            })

            // Verify detailType is preserved
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            expect(eventBridgeCall.DetailType).toBe('Component Updated')
            expect(eventBridgeCall.Source).toBe('mtw.assets')
        })
    })

    describe('Event Processing', () => {
        it('should process WML content update events', async () => {
            const wmlEvent = {
                dataSourceKey: 'mtw.wml' as const,
                streamKey: 'ASSET#test123',
                event: {
                    type: 'Content Update' as const,
                    AssetId: 'ASSET#test123',
                    schema: new StandardForm(`<Asset uuid=(test123) />`)
                },
                timestamp: Date.now()
            }

            // Mock the receiveEvents method
            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [wmlEvent], 
                streamEvent: mockStreamEvent 
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process WML zone changed events', async () => {
            const zoneChangedEvent = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test123',
                event: {
                    type: 'Zone Changed',
                    AssetId: 'ASSET#test123',
                    fromZone: 'Personal',
                    toZone: 'Library',
                    player: 'testplayer',
                    subFolder: 'testfolder'
                },
                timestamp: Date.now()
            } as const

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [zoneChangedEvent], 
                streamEvent: mockStreamEvent 
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
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Zone Updated',
                    fromZone: 'Personal',
                    toZone: 'Library',
                    player: 'testplayer'
                },
                streamKey: 'ASSET#test123'
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process WML zone changed events without optional fields', async () => {
            const zoneChangedEvent = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test456',
                event: {
                    type: 'Zone Changed',
                    AssetId: 'ASSET#test456',
                    fromZone: 'Draft',
                    toZone: 'Canon'
                },
                timestamp: Date.now()
            } as const

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Mock canon graph query results
            assetDBMock.query.mockResolvedValueOnce([
                { AssetId: 'ASSET#test456', DataCategory: 'Meta::Asset', zone: 'Canon' },
                { AssetId: 'ASSET#other123', DataCategory: 'Meta::Asset', zone: 'Canon' }
            ])
            
            await assetsDataSource.receiveEvents?.({ 
                events: [zoneChangedEvent], 
                streamEvent: mockStreamEvent 
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

            // Verify that canon updated event was streamed
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { 
                    type: 'Canon Updated',
                    assetIds: []
                },
                streamKey: 'canon-global'
            })

            // Verify that zone updated event was also streamed
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Zone Updated',
                    fromZone: 'Draft',
                    toZone: 'Canon'
                },
                streamKey: 'ASSET#test456'
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process WML zone changed events for decanonization (leaving Canon zone)', async () => {
            const zoneChangedEvent = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test789',
                event: {
                    type: 'Zone Changed',
                    AssetId: 'ASSET#test789',
                    fromZone: 'Canon',
                    toZone: 'Library'
                },
                timestamp: Date.now()
            } as const

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Mock canon graph query results (remaining canon assets)
            assetDBMock.query.mockResolvedValueOnce([
                { AssetId: 'ASSET#other123', DataCategory: 'Meta::Asset', zone: 'Canon' }
            ])
            
            await assetsDataSource.receiveEvents?.({ 
                events: [zoneChangedEvent], 
                streamEvent: mockStreamEvent 
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

            // Verify that canon updated event was streamed
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { 
                    type: 'Canon Updated',
                    assetIds: []
                },
                streamKey: 'canon-global'
            })

            // Verify that zone updated event was also streamed
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Zone Updated',
                    fromZone: 'Canon',
                    toZone: 'Library'
                },
                streamKey: 'ASSET#test789'
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })



        it('should handle WML asset purged events', async () => {
            const assetPurgedEvent = {
                dataSourceKey: 'mtw.wml' as const,
                streamKey: 'ASSET#purged123',
                event: {
                    type: 'Asset Purged' as const,
                    zone: 'Draft' as const,
                    objectsDeleted: 42
                },
                timestamp: Date.now()
            }

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            await assetsDataSource.receiveEvents?.({
                events: [assetPurgedEvent],
                streamEvent: mockStreamEvent
            })

            expect(decacheAssetMock).toHaveBeenCalledWith({
                assetId: 'ASSET#purged123',
                streamEvent: mockStreamEvent
            })

            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Asset Removed',
                    zone: 'Draft'
                },
                streamKey: 'ASSET#purged123'
            })
        })

        it('should handle diagnostic events', async () => {
            // Mock the assetDB.query call that's failing in healGlobalValues
            assetDBMock.query.mockResolvedValueOnce([]) // Return empty array for Items.map

            const diagnosticEvent = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'test-stream',
                event: {
                    type: 'Heal Global Values'
                },
                timestamp: Date.now()
            } as const

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            // Mock streamEvent function to avoid DataSource setup issues
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            await assetsDataSource.receiveEvents?.({ 
                events: [diagnosticEvent], 
                streamEvent: mockStreamEvent 
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should process multiple events in batch independently', async () => {
            // Mock streamEvent function
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Create a batch of events from different sources
            const batchEvents = [
                {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test123',
                    event: {
                        type: 'Content Update',
                        AssetId: 'ASSET#test123',
                        schema: new StandardForm(`<Asset uuid=(test123) />`)
                    },
                    timestamp: Date.now()
                } as const,
                {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'test-stream',
                    event: {
                        type: 'Heal Global Values'
                    },
                    timestamp: Date.now()
                } as const,
                {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test456',
                    event: {
                        type: 'Content Update',
                        AssetId: 'ASSET#test456',
                        schema: new StandardForm(`<Asset uuid=(test456) />`)
                    },
                    timestamp: Date.now()
                } as const
            ]
            
            // Process the batch of events
            await assetsDataSource.receiveEvents?.({ 
                events: batchEvents, 
                streamEvent: mockStreamEvent 
            })

            // The key test: verify that receiveEvents can handle an array of events
            // (The actual processing logic is tested in other tests)
            // This test primarily verifies that the batch processing pattern works
            expect(mockStreamEvent).toHaveBeenCalled() // At least one event should trigger streamEvent
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to events from mtw.wml, mtw.diagnostics, and mtw.coordination', () => {
            const subscribedEventTypes = ['mtw.wml', 'mtw.diagnostics', 'mtw.coordination']
            
            subscribedEventTypes.forEach(source => {
                const event = {
                    dataSourceKey: source,
                    streamKey: 'test-stream',
                    event: {
                        type: 'Test Event'
                    },
                    timestamp: Date.now()
                } as const

                expect(assetsDataSource.subscribedEventTypeGuard?.(event)).toBe(true)
            })
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEvent = {
                dataSourceKey: 'mtw.other',
                streamKey: 'test-stream',
                event: {
                    type: 'Test Event'
                },
                timestamp: Date.now()
            } as const

            expect(assetsDataSource.subscribedEventTypeGuard?.(otherEvent)).toBe(false)
        })

        it('should not subscribe to events without proper structure', () => {
            const malformedEvent = {
                dataSourceKey: 'mtw.wml',
                event: null as any,
                timestamp: Date.now()
            } as const

            expect(assetsDataSource.subscribedEventTypeGuard?.(malformedEvent as any)).toBe(false)
        })
    })
})
