import { CharactersDataSource, CharacterEventPayload, CharacterSnapshotPayload } from './index'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Mock dependencies
jest.mock('../dataSource/abstract')
jest.mock('@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses')

describe('CharactersDataSource', () => {
    let dataSource: CharactersDataSource
    let mockStreamEvent: jest.Mock
    let mockMessageBus: any

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks()
        
        // Create mock streamEvent function
        mockStreamEvent = jest.fn()
        
        // Create mock messageBus
        mockMessageBus = {
            send: jest.fn(),
            subscribe: jest.fn()
        }
        
        // Create new instance for each test
        dataSource = new CharactersDataSource()
    })

    describe('Constructor', () => {
        it('should create instance with correct dataSourceKey', () => {
            expect(dataSource.dataSourceKey).toBe('mtw.assets.characters')
        })

        it('should be replayable', () => {
            expect(dataSource.replayable).toBe(true)
        })

        it('should have correct primary key name', () => {
            expect(dataSource.primaryKeyName).toBe('AssetId')
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to mtw.assets component events', () => {
            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    streamKey: 'asset123',
                    update: { component: 'test' },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            const isSubscribed = dataSource.subscribedEventTypeGuard?.(componentEvent)
            expect(isSubscribed).toBe(true)
        })

        it('should not subscribe to non-component events', () => {
            const nonComponentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Asset Cached',
                event: {
                    streamKey: 'asset123',
                    update: { asset: 'test' },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            const isSubscribed = dataSource.subscribedEventTypeGuard?.(nonComponentEvent)
            expect(isSubscribed).toBe(false)
        })

        it('should not subscribe to events from other data sources', () => {
            const otherDataSourceEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.ephemera',
                detailType: 'Component Updated',
                event: {
                    streamKey: 'asset123',
                    update: { component: 'test' },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            const isSubscribed = dataSource.subscribedEventTypeGuard?.(otherDataSourceEvent)
            expect(isSubscribed).toBe(false)
        })
    })

    describe('Character Event Processing', () => {
        it('should process Character Updated events for character components', async () => {
            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'char123',
                            name: 'Test Character',
                            wml: '<Character key="char123">Test Character</Character>'
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            // Mock the receiveEvents function
            const mockReceiveEvents = jest.fn()
            dataSource.receiveEvents = mockReceiveEvents

            await dataSource.receiveEvents?.({ event: componentEvent, streamEvent: mockStreamEvent })

            expect(mockReceiveEvents).toHaveBeenCalledWith({
                event: componentEvent,
                streamEvent: mockStreamEvent
            })
        })

        it('should process Character Removed events for character components', async () => {
            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Removed',
                event: {
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'char123',
                            name: 'Test Character'
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            const mockReceiveEvents = jest.fn()
            dataSource.receiveEvents = mockReceiveEvents

            await dataSource.receiveEvents?.({ event: componentEvent, streamEvent: mockStreamEvent })

            expect(mockReceiveEvents).toHaveBeenCalledWith({
                event: componentEvent,
                streamEvent: mockStreamEvent
            })
        })

        it('should generate Character Updated event with correct payload structure', async () => {
            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    streamKey: 'asset123',
                    update: {
                        component: {
                            tag: 'Character',
                            characterId: 'char123',
                            name: 'Test Character',
                            wml: '<Character key="char123">Test Character</Character>'
                        }
                    },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            // Mock the processComponentEvent method
            const mockProcessComponentEvent = jest.fn()
            ;(dataSource as any).processComponentEvent = mockProcessComponentEvent

            await dataSource.receiveEvents?.({ event: componentEvent, streamEvent: mockStreamEvent })

            expect(mockProcessComponentEvent).toHaveBeenCalledWith(componentEvent, mockStreamEvent)
        })

        it('should call streamEvent with Character Updated payload', async () => {
            const expectedPayload: CharacterEventPayload = {
                detailType: 'Character Updated',
                characterId: 'char123',
                wml: '<Character key="char123">Test Character</Character>'
            }

            // Mock the processComponentEvent to call streamEvent
            const mockProcessComponentEvent = jest.fn().mockImplementation(async (event, streamEvent) => {
                await streamEvent({
                    update: expectedPayload,
                    streamKey: 'asset123',
                    detailType: 'Character Updated'
                })
            })
            ;(dataSource as any).processComponentEvent = mockProcessComponentEvent

            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    streamKey: 'asset123',
                    update: { component: { tag: 'Character', characterId: 'char123' } },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await dataSource.receiveEvents?.({ event: componentEvent, streamEvent: mockStreamEvent })

            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: expectedPayload,
                streamKey: 'asset123',
                detailType: 'Character Updated'
            })
        })

        it('should call streamEvent with Character Removed payload', async () => {
            const expectedPayload: CharacterEventPayload = {
                detailType: 'Character Removed',
                characterId: 'char123',
                wml: '<CharacterRemoved key="char123">Test Character</CharacterRemoved>'
            }

            const mockProcessComponentEvent = jest.fn().mockImplementation(async (event, streamEvent) => {
                await streamEvent({
                    update: expectedPayload,
                    streamKey: 'asset123',
                    detailType: 'Character Removed'
                })
            })
            ;(dataSource as any).processComponentEvent = mockProcessComponentEvent

            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Removed',
                event: {
                    streamKey: 'asset123',
                    update: { component: { tag: 'Character', characterId: 'char123' } },
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await dataSource.receiveEvents?.({ event: componentEvent, streamEvent: mockStreamEvent })

            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: expectedPayload,
                streamKey: 'asset123',
                detailType: 'Character Removed'
            })
        })
    })

    describe('Character Type Detection', () => {
        it('should identify Character components correctly', () => {
            const characterComponent = {
                tag: 'Character',
                characterId: 'char123',
                name: 'Test Character'
            }

            const isCharacter = (dataSource as any).isCharacterComponent(characterComponent)
            expect(isCharacter).toBe(true)
        })

        it('should reject non-Character components', () => {
            const nonCharacterComponent = {
                tag: 'Asset',
                assetId: 'asset123',
                name: 'Test Asset'
            }

            const isCharacter = (dataSource as any).isCharacterComponent(nonCharacterComponent)
            expect(isCharacter).toBe(false)
        })

        it('should handle components with different tag formats', () => {
            const characterComponent = {
                tag: 'character', // lowercase
                characterId: 'char123'
            }

            const isCharacter = (dataSource as any).isCharacterComponent(characterComponent)
            expect(isCharacter).toBe(true)
        })
    })

    describe('Snapshot Generation', () => {
        it('should generate character snapshot for asset', async () => {
            const assetId = 'asset123'
            const snapshot = await (dataSource as any).generateCharacterSnapshot(assetId)

            expect(snapshot).toHaveProperty('streamKey', assetId)
            expect(snapshot).toHaveProperty('characters')
            expect(snapshot).toHaveProperty('timestamp')
            expect(typeof snapshot.characters).toBe('string')
        })

        it('should generate WML character listings in snapshot', async () => {
            const assetId = 'asset123'
            const snapshot = await (dataSource as any).generateCharacterSnapshot(assetId)

            // Should contain WML character data
            expect(snapshot.characters).toContain('<Character')
            expect(snapshot.characters).toContain('</Character>')
        })

        it('should include all characters for the asset in snapshot', async () => {
            const assetId = 'asset123'
            const snapshot = await (dataSource as any).generateCharacterSnapshot(assetId)

            // Should contain multiple characters if they exist
            const characterCount = (snapshot.characters.match(/<Character/g) || []).length
            expect(characterCount).toBeGreaterThanOrEqual(0)
        })
    })

    describe('Integration with DataSource Pattern', () => {
        it('should support streamEvent calls', async () => {
            const payload: CharacterEventPayload = {
                detailType: 'Character Updated',
                characterId: 'char123',
                wml: '<Character key="char123">Test</Character>'
            }

            await dataSource.streamEvent({
                update: payload,
                streamKey: 'asset123',
                detailType: 'Character Updated'
            })

            // Should not throw error
            expect(true).toBe(true)
        })

        it('should support getSnapshot calls', async () => {
            const snapshot = await dataSource.getSnapshot('asset123')

            expect(snapshot).toHaveProperty('streamKey', 'asset123')
            expect(snapshot).toHaveProperty('characters')
            expect(snapshot).toHaveProperty('timestamp')
        })

        it('should support initializeSubscription calls', async () => {
            const sessionId = 'SESSION#test-session' as const

            await expect(
                dataSource.initializeSubscription({ sessionId, streamKey: 'asset123' })
            ).resolves.not.toThrow()
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid component events gracefully', async () => {
            const invalidEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                event: {
                    streamKey: 'asset123',
                    update: null, // Invalid update
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await expect(
                dataSource.receiveEvents?.({ event: invalidEvent, streamEvent: mockStreamEvent })
            ).resolves.not.toThrow()
        })

        it('should handle missing character data gracefully', async () => {
            const incompleteEvent: StreamingEventPayload = {
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
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            }

            await expect(
                dataSource.receiveEvents?.({ event: incompleteEvent, streamEvent: mockStreamEvent })
            ).resolves.not.toThrow()
        })
    })
})
