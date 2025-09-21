import { charactersDataSource, CharacterEventPayload, CharacterSnapshotPayload } from './index'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ComponentEventUpdate } from '../dataSource/serializers'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import getCurrentTimestamp from '../internalUtils/dateUtil'

// Mock external dependencies used by the assets DataSource base class and lambda
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
    snsClient: { send: jest.fn() }
}))

jest.mock('../messageBus')

jest.mock('../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn()
}))


describe('CharactersDataSource', () => {
    let dataSource: typeof charactersDataSource
    const FIXED_TS = 1700000000000
    const getCurrentTimestampMock = getCurrentTimestamp as jest.MockedFunction<typeof getCurrentTimestamp>
    const assetDBMock = jest.mocked(assetDB, { shallow: false })
    const eventBridgeSendMock = jest.mocked(eventBridgeClient.send, { shallow: false })

    beforeEach(() => {
        jest.clearAllMocks()
        dataSource = charactersDataSource
        getCurrentTimestampMock.mockReturnValue(FIXED_TS)
        
        // Mock DynamoDB calls
        assetDBMock.putItem.mockResolvedValue(undefined)
        assetDBMock.query.mockResolvedValue([])
    })

    describe('Constructor', () => {
        it('should create instance with correct configuration', () => {
            expect(dataSource.dataSourceKey).toBe('mtw.assets.characters')
            expect(dataSource.replayable).toBe(true)
            expect(dataSource.primaryKeyName).toBe('AssetId')
        })
    })

    describe('Character Event Processing', () => {
        it('should process Character component updates and stream character events', async () => {
            const mockStreamEvent = jest.fn()
            
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Test Character',
                universalKey: 'CHARACTER#char123'
            })

            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'Component Updated',
                        assetId: 'ASSET#asset123',
                        component
                    } as ComponentEventUpdate
                },
                timestamp: FIXED_TS
            }

            // Process the event
            await dataSource.receiveEvents?.({ events: [componentEvent], streamEvent: mockStreamEvent })

            // Should have called streamEvent with character event
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Character Updated',
                    component: component // Should pass the StandardCharacter object
                },
                streamKey: 'ASSET#asset123',
                detailType: 'Character Updated'
            })
        })

        it('should process Character component removals and stream character removed events', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Test Character',
                universalKey: 'CHARACTER#char123'
            })

            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'Component Removed',
                        assetId: 'ASSET#asset123',
                        componentId: 'CHARACTER#char123'
                    } as ComponentEventUpdate
                },
                timestamp: FIXED_TS
            }

            const mockStreamEvent = jest.fn()
            
            await dataSource.receiveEvents?.({ events: [componentEvent], streamEvent: mockStreamEvent })

            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Character Removed',
                    characterId: 'CHARACTER#char123'
                    // component field omitted for removals
                },
                streamKey: 'ASSET#asset123',
                detailType: 'Character Removed'
            })
        })

        it('should ignore non-Character component events', async () => {
            const mockStreamEvent = jest.fn()
            
            const nonCharacterEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'Component Updated',
                        assetId: 'ASSET#asset123',
                        component: {
                            tag: 'Room',
                            roomId: 'ROOM#room123',
                            name: 'Test Room'
                        } as any // Non-StandardCharacter component
                    } as ComponentEventUpdate
                },
                timestamp: FIXED_TS
            }

            await dataSource.receiveEvents?.({ events: [nonCharacterEvent], streamEvent: mockStreamEvent })

            // Should not have called streamEvent
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should ignore events from other data sources', async () => {
            const mockStreamEvent = jest.fn()
            
            const component = new StandardCharacter({
                tag: 'Character',
                universalKey: 'CHARACTER#char123'
            })

            const otherDataSourceEvent = {
                dataSourceKey: 'mtw.otherDataSource',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'Component Updated',
                        assetId: 'ASSET#asset123',
                        component
                    },
                    timestamp: FIXED_TS
                },
                timestamp: FIXED_TS
            }

            await dataSource.receiveEvents?.({ events: [otherDataSourceEvent as any], streamEvent: mockStreamEvent })

            // Should not have called streamEvent
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should process multiple character events in batch independently', async () => {
            const mockStreamEvent = jest.fn()
            
            const component1 = new StandardCharacter({
                tag: 'Character',
                shortName: 'Character 1',
                universalKey: 'CHARACTER#char1'
            })

            const component2 = new StandardCharacter({
                tag: 'Character',
                shortName: 'Character 2',
                universalKey: 'CHARACTER#char2'
            })

            const batchEvents = [
                {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset1',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset1',
                            component: component1
                        } as ComponentEventUpdate
                    },
                    timestamp: FIXED_TS
                },
                {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset2',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset2',
                            component: component2
                        } as ComponentEventUpdate
                    },
                    timestamp: FIXED_TS
                }
            ]

            // Process the batch of events
            await dataSource.receiveEvents?.({ 
                events: batchEvents, 
                streamEvent: mockStreamEvent 
            })

            // Should process both character events
            expect(mockStreamEvent).toHaveBeenCalledTimes(2)
            expect(mockStreamEvent).toHaveBeenNthCalledWith(1, {
                update: {
                    type: 'Character Updated',
                    component: component1
                },
                streamKey: 'ASSET#asset1',
                detailType: 'Character Updated'
            })
            expect(mockStreamEvent).toHaveBeenNthCalledWith(2, {
                update: {
                    type: 'Character Updated',
                    component: component2
                },
                streamKey: 'ASSET#asset2',
                detailType: 'Character Updated'
            })
        })
    })

    // Character type detection is tested indirectly through the event processing tests above

    describe('EventBridge Serialization', () => {
        it('should serialize Character Updated events to EventBridge with WML', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Test Character',
                universalKey: 'CHARACTER#char123'
            })

            // Mock the assetDB.putItem call that streamEvent needs
            assetDBMock.putItem.mockResolvedValue({})

            await dataSource.streamEvent({
                update: {
                    type: 'Character Updated',
                    component
                },
                streamKey: 'ASSET#asset123',
                detailType: 'Character Updated'
            })

            // Verify EventBridge event structure and serialization
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets.characters',
                        DetailType: 'Character Updated',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset123',
                            update: expect.objectContaining({
                                characterId: 'CHARACTER#char123',
                                wml: expect.stringContaining('<Character uuid=(char123)>')
                            })
                        })
                    })
                ])
            )

            // Verify the WML matches expected content exactly
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            const serializedUpdate = eventBridgeCall.Detail.update
            expect(serializedUpdate.characterId).toBe('CHARACTER#char123')
            expect(serializedUpdate.wml).toEqual(deIndentWML(`<Character uuid=(char123)><ShortName>Test Character</ShortName></Character>`))
        })

        it('should serialize Character Removed events to EventBridge with WML', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Removed Character',
                universalKey: 'CHARACTER#char456'
            })

            // Mock the assetDB.putItem call that streamEvent needs
            assetDBMock.putItem.mockResolvedValue({})

            await dataSource.streamEvent({
                update: {
                    type: 'Character Removed',
                    characterId: 'CHARACTER#char456'
                },
                streamKey: 'ASSET#asset456',
                detailType: 'Character Removed'
            })

            // Verify EventBridge event structure and serialization
            expect(eventBridgeSendMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        Source: 'mtw.assets.characters',
                        DetailType: 'Character Removed',
                        Detail: expect.objectContaining({
                            streamKey: 'ASSET#asset456',
                            update: expect.objectContaining({
                                characterId: 'CHARACTER#char456'
                                // No wml field for removal events
                            })
                        })
                    })
                ])
            )

            // Verify the removal event structure
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            const serializedUpdate = eventBridgeCall.Detail.update
            expect(serializedUpdate.characterId).toBe('CHARACTER#char456')
            expect(serializedUpdate.wml).toBeUndefined() // No WML content for removal events
        })

        it('should handle serialization of complex Character objects', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Complex Character',
                pronouns: 'they/them',
                universalKey: 'CHARACTER#complex123'
                // Note: StandardCharacter may not support description field
            })

            // Mock the assetDB.putItem call that streamEvent needs
            assetDBMock.putItem.mockResolvedValue({})

            await dataSource.streamEvent({
                update: {
                    type: 'Character Updated',
                    component
                },
                streamKey: 'ASSET#complex-asset',
                detailType: 'Character Updated'
            })

            // Verify the serialized WML matches expected content exactly
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            const serializedUpdate = eventBridgeCall.Detail.update
            
            expect(serializedUpdate.characterId).toBe('CHARACTER#complex123')
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

            // Mock the assetDB.putItem call that streamEvent needs
            assetDBMock.putItem.mockResolvedValue({})

            await dataSource.streamEvent({
                update: {
                    type: 'Character Updated',
                    component
                },
                streamKey: 'ASSET#metadata-asset',
                detailType: 'Character Updated'
            })

            // Verify detailType is preserved
            const eventBridgeCall = eventBridgeSendMock.mock.calls[0][0][0]
            expect(eventBridgeCall.DetailType).toBe('Character Updated')
            expect(eventBridgeCall.Source).toBe('mtw.assets.characters')
        })
    })

    describe('Snapshot Generation', () => {
        it('should query primary component storage for characters by asset UUID', async () => {
            const assetUUID = 'asset-uuid-123'
            assetDBMock.query.mockResolvedValueOnce([
                {
                    AssetId: 'CHARACTER#char-001',
                    DataCategory: assetUUID,
                    shortName: 'Alpha',
                    pronouns: 'they/them'
                },
                {
                    AssetId: 'CHARACTER#char-002',
                    DataCategory: assetUUID,
                    shortName: 'Beta'
                }
            ])

            await dataSource.getSnapshot(assetUUID)

            expect(assetDB.query).toHaveBeenCalledWith(expect.objectContaining({
                IndexName: 'DataCategoryIndex',
                Key: { DataCategory: assetUUID },
                KeyConditionExpression: expect.stringContaining('begins_with(AssetId'),
                ExpressionAttributeValues: expect.objectContaining({ ':prefix': 'CHARACTER#' }),
                allFields: true
            }))
        })

        it('should compose WML character listings from query results (expected to fail until implemented)', async () => {
            const assetUUID = 'ASSET#asset-uuid-456'
            // Reset the mock and set up a new one for this test
            assetDBMock.query.mockReset()
            assetDBMock.query.mockResolvedValueOnce([
                {
                    AssetId: 'CHARACTER#char-001',
                    DataCategory: assetUUID,
                    key: 'char-001',
                    shortName: 'Alpha'
                },
                {
                    AssetId: 'CHARACTER#char-002',
                    DataCategory: assetUUID,
                    key: 'char-002',
                    shortName: 'Beta'
                }
            ])

            const snapshot = await dataSource.getSnapshot(assetUUID)

            expect(snapshot.streamKey).toBe(assetUUID)
            expect((snapshot as any).characters).toEqual(deIndentWML(`
                <Asset key=(asset-uuid-456)>
                    <Character uuid=(char-001) key=(char-001)>
                        <ShortName>Alpha</ShortName>
                    </Character>
                    <Character uuid=(char-002) key=(char-002)>
                        <ShortName>Beta</ShortName>
                    </Character>
                </Asset>
            `))
        })
    })

    describe('DataSource Integration', () => {
        it('should support getSnapshot calls', async () => {
            const testStreamKey = 'integration-test-asset'
            
            // Reset the mock and set up a new one for this test
            assetDBMock.query.mockReset()
            assetDBMock.query.mockResolvedValueOnce([
                {
                    AssetId: 'CHARACTER#char-001',
                    DataCategory: testStreamKey,
                    key: 'char-001',
                    shortName: 'Test Character'
                }
            ])

            const snapshot = await dataSource.getSnapshot(testStreamKey)

            // Now that caching is per-streamKey, we can test the specific content
            expect(snapshot).toHaveProperty('streamKey', testStreamKey)
            expect(snapshot).toHaveProperty('characters')
            expect(snapshot).toHaveProperty('timestamp')
            expect(snapshot.characters).toEqual(deIndentWML(`
                <Asset key=(integration-test-asset)>
                    <Character uuid=(char-001) key=(char-001)>
                        <ShortName>Test Character</ShortName>
                    </Character>
                </Asset>
            `))
        })

        it('should support initializeSubscription calls', async () => {
            const sessionId = 'SESSION#session123'
            
            await expect(
                dataSource.initializeSubscription({ sessionId, streamKey: 'asset123' })
            ).resolves.not.toThrow()
        })

        it('should support streamEvent calls', async () => {
            const component = new StandardCharacter({
                tag: 'Character',
                shortName: 'Test',
                universalKey: 'CHARACTER#char123'
            })

            await dataSource.streamEvent({
                update: {
                    type: 'Character Updated',
                    component
                },
                streamKey: 'ASSET#asset123',
                detailType: 'Character Updated'
            })

            // Should not throw
            expect(true).toBe(true)
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid component events gracefully', async () => {
            const mockStreamEvent = jest.fn()
            
            const invalidEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'asset123',
                    update: {
                        type: 'Component Updated',
                        assetId: 'ASSET#asset123',
                        component: null // Invalid component
                    } as any // Allow null component for testing
                },
                timestamp: FIXED_TS
            }

            await expect(
                dataSource.receiveEvents?.({ events: [invalidEvent], streamEvent: mockStreamEvent })
            ).resolves.not.toThrow()

            // Should not have called streamEvent
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle missing character data gracefully', async () => {
            const mockStreamEvent = jest.fn()
            
            const incompleteEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'asset123',
                    update: {
                        type: 'Component Updated',
                        assetId: 'ASSET#asset123',
                        component: {
                            tag: 'Character'
                            // Missing other required data
                        } as any
                    } as ComponentEventUpdate
                },
                timestamp: FIXED_TS
            }

            await expect(
                dataSource.receiveEvents?.({ events: [incompleteEvent], streamEvent: mockStreamEvent })
            ).resolves.not.toThrow()

            // Should not call streamEvent since component is not a valid StandardCharacter
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })
    })
})
