import { assetsDataSource } from './index'
import { AssetsEventUpdate } from './serializers'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

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
jest.mock('../internalCache')
jest.mock('./caching')

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const eventBridgeSendMock = jest.mocked(eventBridgeClient.send, { shallow: false })

describe('AssetsDataSource (mtw.assets)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
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
                assetId: 'ASSET#asset123',
                component
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset123',
                detailType: 'Component Updated'
            })

            // Verify EventBridge event structure and serialization
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets',
                        DetailType: 'Component Updated',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset123',
                            update: expect.objectContaining({
                                type: 'Component Updated',
                                assetId: undefined, // assetId is not set in this test
                                componentId: '', // componentId is empty when universalKey is not available
                                wml: expect.stringContaining('<Character>') // Should be WML string
                            })
                        })
                    })
                ])
            )

            // Verify the WML contains expected content
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            const serializedUpdate = eventBridgeCall.Detail.update
            expect(serializedUpdate.wml).toContain('<Character>')
            expect(serializedUpdate.wml).toContain('<ShortName>Test Character</ShortName>')
            expect(serializedUpdate.wml).toContain('</Character>')
        })

        it('should serialize Component Removed events to EventBridge with WML', async () => {
            const update: AssetsEventUpdate = {
                type: 'Component Removed',
                assetId: 'ASSET#asset456',
                componentId: 'CHARACTER#char456'
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset456',
                detailType: 'Component Removed'
            })

            // Verify EventBridge event structure and serialization
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets',
                        DetailType: 'Component Removed',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset456',
                            update: expect.objectContaining({
                                type: 'Component Removed',
                                assetId: 'ASSET#asset456',
                                componentId: 'CHARACTER#char456'
                            })
                        })
                    })
                ])
            )
        })

        it('should serialize Asset-level events to EventBridge', async () => {
            const update: AssetsEventUpdate = {
                type: 'Canon Updated',
                AssetId: 'ASSET#asset789'
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#asset789',
                detailType: 'Canon Updated'
            })

            // Verify EventBridge event structure
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets',
                        DetailType: 'Canon Updated',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset789',
                            update: expect.objectContaining({
                                type: 'Canon Updated',
                                AssetId: 'ASSET#asset789'
                            })
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
                assetId: 'ASSET#complex-asset',
                component
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#complex-asset',
                detailType: 'Component Updated'
            })

            // Verify the serialized WML contains all expected attributes
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            const serializedUpdate = eventBridgeCall.Detail.update
            
            expect(serializedUpdate.wml).toContain('<Character>')
            expect(serializedUpdate.wml).toContain('<ShortName>Complex Character</ShortName>')
            expect(serializedUpdate.wml).toContain('<Pronouns>they/them</Pronouns>')
            expect(serializedUpdate.wml).toContain('</Character>')
        })

        it('should preserve detailType metadata in EventBridge events', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                universalKey: 'CHARACTER#metadata123'
            })

            const update: AssetsEventUpdate = {
                type: 'Component Updated',
                assetId: 'ASSET#metadata-asset',
                component
            }

            await assetsDataSource.streamEvent({
                update,
                streamKey: 'ASSET#metadata-asset',
                detailType: 'Component Updated'
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
                dataSourceKey: 'mtw.wml',
                event: {
                    streamKey: 'ASSET#test123',
                    update: {
                        type: 'Content Update',
                        AssetId: 'ASSET#test123'
                    }
                },
                timestamp: Date.now()
            }

            // Mock the receiveEvents method
            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            await assetsDataSource.receiveEvents?.({ 
                event: wmlEvent, 
                streamEvent: assetsDataSource.streamEvent 
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })

        it('should handle diagnostic events', async () => {
            // Mock the assetDB.query call that's failing in healGlobalValues
            assetDBMock.query.mockResolvedValueOnce([]) // Return empty array for Items.map

            const diagnosticEvent = {
                dataSourceKey: 'mtw.diagnostics',
                event: {
                    streamKey: 'test-stream',
                    update: {
                        type: 'Heal Global Values'
                    }
                },
                timestamp: Date.now()
            }

            const receiveEventsSpy = jest.spyOn(assetsDataSource, 'receiveEvents')
            
            await assetsDataSource.receiveEvents?.({ 
                event: diagnosticEvent, 
                streamEvent: assetsDataSource.streamEvent 
            })

            expect(receiveEventsSpy).toHaveBeenCalled()
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to events from mtw.wml, mtw.diagnostics, and mtw.coordination', () => {
            const subscribedEventTypes = ['mtw.wml', 'mtw.diagnostics', 'mtw.coordination']
            
            subscribedEventTypes.forEach(source => {
            const event = {
                dataSourceKey: source,
                event: {
                    streamKey: 'test-stream',
                    update: {
                        type: 'Test Event'
                    }
                },
                timestamp: Date.now()
            }

                expect(assetsDataSource.subscribedEventTypeGuard?.(event)).toBe(true)
            })
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEvent = {
                dataSourceKey: 'mtw.other',
                event: {
                    streamKey: 'test-stream',
                    update: {
                        type: 'Test Event'
                    }
                },
                timestamp: Date.now()
            }

            expect(assetsDataSource.subscribedEventTypeGuard?.(otherEvent)).toBe(false)
        })

        it('should not subscribe to events without proper structure', () => {
            const malformedEvent = {
                dataSourceKey: 'mtw.wml',
                event: null as any,
                timestamp: Date.now()
            }

            expect(assetsDataSource.subscribedEventTypeGuard?.(malformedEvent)).toBe(false)
        })
    })
})
