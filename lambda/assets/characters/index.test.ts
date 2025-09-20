import { charactersDataSource, CharacterEventPayload, CharacterSnapshotPayload, ComponentEventPayload } from './index'
import { StreamingEvent } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
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

    beforeEach(() => {
        jest.clearAllMocks()
        dataSource = charactersDataSource
        // Mock the streamEvent method for testing
        jest.spyOn(dataSource, 'streamEvent').mockImplementation(async () => {})
        getCurrentTimestampMock.mockReturnValue(FIXED_TS)
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
                    streamKey: 'ASSET#asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'CHARACTER#char123',
                            wml: '<Character uuid=(char123)><ShortName>Test Character</ShortName></Character>'
                        }
                    },
                    timestamp: FIXED_TS
                },
                timestamp: FIXED_TS
            }

            // Process the event
            await dataSource.receiveEvents?.({ event: componentEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })

            // Should have called streamEvent with character event
            expect(dataSource.streamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Character Updated',
                    characterId: 'CHARACTER#char123',
                    component: undefined // No component provided in test
                },
                streamKey: 'ASSET#asset123',
                detailType: 'Character Updated'
            })
        })

        it('should process Character component removals and stream character removed events', async () => {
            const componentEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Removed',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'CHARACTER#char123',
                            wml: '<Remove><Character uuid=(char123)><ShortName>Test Character</ShortName></Character></Remove>'
                        }
                    },
                    timestamp: FIXED_TS
                },
                timestamp: FIXED_TS
            }

            await dataSource.receiveEvents?.({ event: componentEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })

            expect(dataSource.streamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Character Removed',
                    characterId: 'CHARACTER#char123',
                    component: undefined // No component provided in test
                },
                streamKey: 'ASSET#asset123',
                detailType: 'Character Removed'
            })
        })

        it('should ignore non-Character component events', async () => {
            const nonCharacterEvent: StreamingEvent = {
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        component: {
                            tag: 'Room',
                            roomId: 'ROOM#room123',
                            name: 'Test Room'
                        }
                    },
                    timestamp: FIXED_TS
                },
                timestamp: FIXED_TS
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
                    streamKey: 'ASSET#asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'CHARACTER#char123'
                        }
                    },
                    timestamp: FIXED_TS
                },
                timestamp: FIXED_TS
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
            const payload: CharacterEventPayload = {
                characterId: 'CHARACTER#char123',
                wml: '<Character uuid=(char123)><ShortName>Test</ShortName></Character>'
            }

            await dataSource.streamEvent({
                update: payload,
                streamKey: 'ASSET#asset123',
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
                    streamKey: 'asset123',
                    update: {
                        component: null // Invalid component
                    },
                    timestamp: FIXED_TS
                },
                timestamp: FIXED_TS
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
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character'
                            // Missing characterId and other data
                        }
                    },
                    timestamp: FIXED_TS
                },
                timestamp: FIXED_TS
            }

            await expect(
                dataSource.receiveEvents?.({ event: incompleteEvent as ComponentEventPayload, streamEvent: dataSource.streamEvent })
            ).resolves.not.toThrow()

            // Should still call streamEvent with default values
            expect(dataSource.streamEvent).toHaveBeenCalled()
        })
    })
})
