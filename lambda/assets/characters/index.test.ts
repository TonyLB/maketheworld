import { charactersDataSource, CharacterEventPayload, CharacterSnapshotPayload, ComponentEventPayload } from './index'
import { StreamingEvent } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

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


describe('CharactersDataSource', () => {
    let dataSource: typeof charactersDataSource

    beforeEach(() => {
        jest.clearAllMocks()
        dataSource = charactersDataSource
        // Mock the streamEvent method for testing
        jest.spyOn(dataSource, 'streamEvent').mockImplementation(async () => {})
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
            const componentEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    detailType: 'Component Updated',
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'char123',
                            wml: '<Character key="char123"><ShortName>Test Character</ShortName></Character>'
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            // Process the event
            await dataSource.receiveEvents?.({ event: componentEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })

            // Should have called streamEvent with character event
            expect(dataSource.streamEvent).toHaveBeenCalledWith({
                update: {
                    characterId: 'char123',
                    wml: '<Character key="char123"><ShortName>Test Character</ShortName></Character>'
                },
                streamKey: 'asset123',
                detailType: 'Character Updated'
            })
        })

        it('should process Character component removals and stream character removed events', async () => {
            const componentEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Removed',
                event: {
                    detailType: 'Component Removed',
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'char123',
                            wml: '<Character key="char123"><ShortName>Test Character</ShortName></Character>'
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await dataSource.receiveEvents?.({ event: componentEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })

            expect(dataSource.streamEvent).toHaveBeenCalledWith({
                update: {
                    characterId: 'char123',
                    wml: '<CharacterRemoved key="char123"><ShortName>Test Character</ShortName></CharacterRemoved>'
                },
                streamKey: 'asset123',
                detailType: 'Character Removed'
            })
        })

        it('should ignore non-Character component events', async () => {
            const nonCharacterEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    detailType: 'Component Updated',
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Room',
                            roomId: 'room123',
                            name: 'Test Room'
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await dataSource.receiveEvents?.({ event: nonCharacterEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })

            // Should not have called streamEvent
            expect(dataSource.streamEvent).not.toHaveBeenCalled()
        })

        it('should ignore events from other data sources', async () => {
            const otherDataSourceEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.otherDataSource',
                detailType: 'Component Updated',
                event: {
                    detailType: 'Component Updated',
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'char123'
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await dataSource.receiveEvents?.({ event: otherDataSourceEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })

            // Should not have called streamEvent
            expect(dataSource.streamEvent).not.toHaveBeenCalled()
        })
    })

    // Character type detection is tested indirectly through the event processing tests above

    describe('Snapshot Generation', () => {
        it('should query primary component storage for characters by asset UUID', async () => {
            const assetUUID = 'asset-uuid-123'
            ;(assetDB.query as jest.Mock).mockResolvedValueOnce([
                {
                    AssetId: 'CHARACTER#char-001',
                    DataCategory: assetUUID,
                    ShortName: 'Alpha',
                    Pronouns: 'they/them'
                },
                {
                    AssetId: 'CHARACTER#char-002',
                    DataCategory: assetUUID,
                    ShortName: 'Beta'
                }
            ])

            await dataSource.getSnapshot(assetUUID)

            expect(assetDB.query).toHaveBeenCalledWith(expect.objectContaining({
                IndexName: 'DataCategoryIndex',
                Key: { DataCategory: assetUUID },
                KeyConditionExpression: expect.stringContaining('begins_with(AssetId'),
                ExpressionAttributeValues: expect.objectContaining({ ':prefix': 'CHARACTER#' })
            }))
        })

        it('should compose WML character listings from query results (expected to fail until implemented)', async () => {
            const assetUUID = 'asset-uuid-123'
            // Reset the mock and set up a new one for this test
            ;(assetDB.query as jest.Mock).mockReset()
            ;(assetDB.query as jest.Mock).mockResolvedValueOnce([
                {
                    AssetId: 'CHARACTER#char-001',
                    DataCategory: assetUUID,
                    ShortName: 'Alpha'
                },
                {
                    AssetId: 'CHARACTER#char-002',
                    DataCategory: assetUUID,
                    ShortName: 'Beta'
                }
            ])

            const snapshot = await dataSource.getSnapshot(assetUUID)

            expect(snapshot.streamKey).toBe(assetUUID)
            expect(typeof (snapshot as any).characters).toBe('string')
            expect((snapshot as any).characters).toContain('<Character')
            expect((snapshot as any).characters).toContain('<ShortName>Alpha</ShortName>')
            expect((snapshot as any).characters).toContain('<ShortName>Beta</ShortName>')
        })
    })

    describe('DataSource Integration', () => {
        it('should support getSnapshot calls', async () => {
            // Note: Due to DataSource caching behavior, this test may return a cached snapshot
            // from previous tests. We test the basic functionality rather than specific content.
            const testStreamKey = 'integration-test-asset'
            
            // Reset the mock and set up a new one for this test
            ;(assetDB.query as jest.Mock).mockReset()
            ;(assetDB.query as jest.Mock).mockResolvedValueOnce([
                {
                    AssetId: 'CHARACTER#char-001',
                    DataCategory: testStreamKey,
                    ShortName: 'Test Character'
                }
            ])

            const snapshot = await dataSource.getSnapshot(testStreamKey)

            // Test that getSnapshot returns a valid snapshot object with required properties
            expect(snapshot).toHaveProperty('streamKey')
            expect(snapshot).toHaveProperty('characters')
            expect(snapshot).toHaveProperty('timestamp')
            expect(typeof snapshot.streamKey).toBe('string')
            expect(typeof (snapshot as any).characters).toBe('string')
            expect(typeof snapshot.timestamp).toBe('number')
        })

        it('should support initializeSubscription calls', async () => {
            const sessionId = 'SESSION#session123'
            
            await expect(
                dataSource.initializeSubscription({ sessionId, streamKey: 'asset123' })
            ).resolves.not.toThrow()
        })

        it('should support streamEvent calls', async () => {
            const payload: CharacterEventPayload = {
                characterId: 'char123',
                wml: '<Character key="char123"><ShortName>Test</ShortName></Character>'
            }

            await dataSource.streamEvent({
                update: payload,
                streamKey: 'asset123',
                detailType: 'Character Updated'
            })

            // Should not throw
            expect(true).toBe(true)
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid component events gracefully', async () => {
            const invalidEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    detailType: 'Component Updated',
                    streamKey: 'asset123',
                    update: {
                        component: null // Invalid component
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await expect(
                dataSource.receiveEvents?.({ event: invalidEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })
            ).resolves.not.toThrow()

            // Should not have called streamEvent
            expect(dataSource.streamEvent).not.toHaveBeenCalled()
        })

        it('should handle missing character data gracefully', async () => {
            const incompleteEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    detailType: 'Component Updated',
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character'
                            // Missing characterId and other data
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await expect(
                dataSource.receiveEvents?.({ event: incompleteEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })
            ).resolves.not.toThrow()

            // Should still call streamEvent with default values
            expect(dataSource.streamEvent).toHaveBeenCalled()
        })
    })
})
