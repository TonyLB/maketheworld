import { DataSource, SerializableObject, SnapshotType, coreFormatToStreamingEnvelope, resolveReplayCursorTimestamp } from './index'
import { StreamingEventHeader } from './baseClasses'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'

// Mock dateUtil
jest.mock('../internalUtils/dateUtil', () => ({
    getCurrentTimestamp: jest.fn()
}))

const mockGetCurrentTimestamp = getCurrentTimestamp as jest.MockedFunction<typeof getCurrentTimestamp>

// Mock singleFlight
jest.mock('../singleFlight', () => ({
    singleFlightFactory: jest.fn(() => jest.fn())
}))

// Mock EventBridge client
jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: {
        send: jest.fn().mockResolvedValue({})
    }
}))

// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-123')
}))

// Mock SNS
jest.mock('@aws-sdk/client-sns', () => ({
    PublishCommand: jest.fn().mockImplementation((params) => params)
}))

// Import the mocked modules after mocking
import { singleFlightFactory } from '../singleFlight'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { v4 as uuidv4 } from 'uuid'
import { PublishCommand } from '@aws-sdk/client-sns'
import { EventPayload } from './baseClasses'

const mockSingleFlightFactory = singleFlightFactory as jest.MockedFunction<typeof singleFlightFactory>
const mockEventBridgeClient = eventBridgeClient as jest.Mocked<typeof eventBridgeClient>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>
const mockPublishCommand = PublishCommand as jest.MockedClass<typeof PublishCommand>

type TestSnapshotPayload = {
    id: string
    name: string
    value: number
}

type TestUpdatePayload = {
    type: 'TestUpdatePayload',  
    update: string
}

// Test subclass to expose protected methods
class TestDataSource<
    SnapshotPayload extends SerializableObject, 
    UpdatePayload extends EventPayload, 
    ExternalUpdatePayload extends EventPayload = EventPayload, 
    KeyType extends string = string,
    ExternalSnapshotPayload extends SerializableObject = SnapshotPayload
> extends DataSource<SnapshotPayload, UpdatePayload, never, ExternalUpdatePayload, KeyType, ExternalSnapshotPayload> {
    public override async loadSnapshotFromStore(streamKey: string): Promise<SnapshotType<ExternalSnapshotPayload> | undefined> {
        return super.loadSnapshotFromStore(streamKey)
    }
    
    public override async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        return super.storeSnapshotToStore({ streamKey, snapshot })
    }

    public override async getRecentEvents(streamKey: string, sinceTimestamp: number): Promise<Array<{ update: ExternalUpdatePayload, timestamp: number, streamKey: string, type: string }>> {
        return super.getRecentEvents(streamKey, sinceTimestamp)
    }
}

describe('DataSource', () => {
    let mockDynamo: any
    let mockSns: any
    let mockMessageBus: any
    let mockSnapshotContentGenerator: jest.MockedFunction<(streamKey: string) => Promise<TestSnapshotPayload>>
    let mockSingleFlight: jest.MockedFunction<any>
    let dataSource: TestDataSource<TestSnapshotPayload, TestUpdatePayload>

    beforeEach(() => {
        jest.clearAllMocks()
        
        // Mock getCurrentTimestamp to return predictable values
        mockGetCurrentTimestamp.mockReturnValue(100000000)
        
        
        // Mock DynamoDB utilities
        mockDynamo = {
            putItem: jest.fn().mockResolvedValue(undefined),
            getItem: jest.fn(),
            query: jest.fn(),
            optimisticUpdate: jest.fn()
        }
        
        // Mock SNS utilities
        mockSns = {
            send: jest.fn().mockResolvedValue({})
        }
        
        // Mock messageBus
        mockMessageBus = {
            publish: jest.fn(),
            subscribe: jest.fn()
        }
        
        // Mock snapshot content generator
        mockSnapshotContentGenerator = jest.fn().mockResolvedValue({
            id: 'test-id',
            name: 'Test Snapshot',
            value: 42
        })
        
        // Mock singleFlight
        mockSingleFlight = jest.fn().mockResolvedValue({
            id: 'test-id',
            name: 'Test Snapshot',
            value: 42,
            createdAt: 100000000,
            expiresAt: 100300000
        })
        
        // Mock singleFlightFactory to return our mock
        mockSingleFlightFactory.mockReturnValue(mockSingleFlight)
        
        // Mock EventBridge client
        mockEventBridgeClient.send.mockResolvedValue({ Entries: [] } as any)
        
        // Create TestDataSource instance
        dataSource = new TestDataSource({
            dynamo: mockDynamo,
            sns: mockSns,
            messageBus: mockMessageBus,
            primaryKeyName: 'AssetId',
            dataSourceKey: 'mtw.testDataSource',
            snapshotContentGenerator: mockSnapshotContentGenerator,
            feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
            snapshotTimeoutMs: 5000
        })
    })

    describe('constructor', () => {
        it('should initialize with provided configuration', () => {
            expect(dataSource.dynamo).toBe(mockDynamo)
            expect(dataSource.sns).toBe(mockSns)
            expect(dataSource.primaryKeyName).toBe('AssetId')
            expect(dataSource.dataSourceKey).toBe('mtw.testDataSource')
            expect(dataSource.snapshotContentGenerator).toBe(mockSnapshotContentGenerator)
            expect(dataSource.feedbackTopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-feedback')
            expect(dataSource._snapshots).toEqual({})
        })

        it('should initialize singleFlight with correct configuration', () => {
            expect(mockSingleFlightFactory).toHaveBeenCalledWith({
                optimisticUpdateFunction: expect.any(Function),  // Bound function
                getItemFunction: expect.any(Function),  // Bound function
                primaryKey: 'AssetId',
                timeoutMs: 5000
            })
        })

        it('should use default snapshotTimeoutMs when not provided', () => {
            const dataSourceWithDefaults = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            
            expect(mockSingleFlightFactory).toHaveBeenCalledWith(
                expect.objectContaining({
                    timeoutMs: 5000 // Default from the implementation
                })
            )
        })
    })

    describe('generateSnapshot', () => {
        it('should generate snapshot with current timestamp and expiration', async () => {
            const streamKey = 'test-stream'
            const expectedContent = {
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42
            }
            
            mockSnapshotContentGenerator.mockResolvedValueOnce(expectedContent)
            
            const result = await dataSource.generateSnapshot(streamKey)
            
            expect(mockSnapshotContentGenerator).toHaveBeenCalledWith(streamKey)
            expect(result).toEqual({
                ...expectedContent,
                createdAt: 100000000,
                replayAt: 100000000,
                expiresAt: 100300000 // 5 minutes later
            })
        })

        it('should use different timestamps for different calls', async () => {
            const streamKey = 'test-stream'
            const expectedContent = {
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42
            }
            
            mockSnapshotContentGenerator.mockResolvedValue(expectedContent)
            
            // First call
            mockGetCurrentTimestamp.mockReturnValueOnce(100000000)
            const result1 = await dataSource.generateSnapshot(streamKey)
            
            // Second call with different timestamp
            mockGetCurrentTimestamp.mockReturnValueOnce(200000000)
            const result2 = await dataSource.generateSnapshot(streamKey)
            
            expect(result1.createdAt).toBe(100000000)
            expect(result1.expiresAt).toBe(100300000)
            expect(result2.createdAt).toBe(200000000)
            expect(result2.expiresAt).toBe(200300000)
        })

        it('should preserve authoritative replayAt from snapshotContentGenerator', async () => {
            const streamKey = 'test-stream'
            mockSnapshotContentGenerator.mockResolvedValueOnce({
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                replayAt: 99999000
            } as unknown as TestSnapshotPayload)

            const result = await dataSource.generateSnapshot(streamKey)

            expect(result.createdAt).toBe(100000000)
            expect(result.replayAt).toBe(99999000)
            expect(result.expiresAt).toBe(100300000)
        })
    })

    describe('getSnapshot', () => {
        it('should return cached snapshot if not expired', async () => {
            const streamKey = 'test-stream'
            const cachedSnapshot = {
                id: 'cached-id',
                name: 'Cached Snapshot',
                value: 100,
                createdAt: 100000000,
                expiresAt: 100300000 // Not expired
            }
            
            // Set up in-memory cache
            dataSource._snapshots['test-stream'] = cachedSnapshot
            
            const result = await dataSource.getSnapshot(streamKey)
            
            expect(result).toBe(cachedSnapshot)
            expect(mockSnapshotContentGenerator).not.toHaveBeenCalled()
            expect(mockSingleFlight).not.toHaveBeenCalled()
        })

        it('should return cached snapshot from store if not expired', async () => {
            const streamKey = 'test-stream'
            const storedSnapshot = {
                id: 'stored-id',
                name: 'Stored Snapshot',
                value: 200,
                createdAt: 100000000,
                expiresAt: 100300000 // Not expired
            }
            
            // Mock loadSnapshotFromStore to return valid snapshot
            jest.spyOn(dataSource, 'loadSnapshotFromStore').mockResolvedValue(storedSnapshot)
            
            const result = await dataSource.getSnapshot(streamKey)
            
            expect(result).toEqual({
                ...storedSnapshot,
                replayAt: 100000000
            })
            expect(dataSource._snapshots[streamKey]).toEqual({
                ...storedSnapshot,
                replayAt: 100000000
            })
            expect(mockSnapshotContentGenerator).not.toHaveBeenCalled()
            expect(mockSingleFlight).not.toHaveBeenCalled()
        })

        it('should generate new snapshot when cache is expired', async () => {
            const streamKey = 'test-stream'
            const expiredSnapshot = {
                id: 'expired-id',
                name: 'Expired Snapshot',
                value: 300,
                createdAt: 100000000,
                expiresAt: 99999999 // Actually expired (before current time)
            }
            
            // Set up expired in-memory cache
            dataSource._snapshots[streamKey] = expiredSnapshot
            
            // Mock loadSnapshotFromStore to return undefined (no stored snapshot)
            jest.spyOn(dataSource, 'loadSnapshotFromStore').mockResolvedValue(undefined)
            
            const result = await dataSource.getSnapshot(streamKey)
            
            expect(mockSingleFlight).toHaveBeenCalledWith({
                category: 'snapshot-generation-mtw.testDataSource',
                argumentHash: streamKey,
                computation: expect.any(Function),
                retrieval: expect.any(Function)
            })
            expect(result).toEqual({
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                replayAt: 100000000,
                expiresAt: 100300000
            })
        })

        it('should use singleFlight computation to generate and store snapshot', async () => {
            const streamKey = 'test-stream'
            
            // Mock loadSnapshotFromStore to return undefined
            jest.spyOn(dataSource, 'loadSnapshotFromStore').mockResolvedValue(undefined)
            
            await dataSource.getSnapshot(streamKey)
            
            const singleFlightCall = mockSingleFlight.mock.calls[0][0]
            const computation = singleFlightCall.computation
            
            // Test the computation function
            const result = await computation()
            
            expect(mockSnapshotContentGenerator).toHaveBeenCalledWith(streamKey)
            expect(result).toEqual({
                type: 'Snapshot',
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                replayAt: 100000000,
                expiresAt: 100300000
            })
        })

        it('should use singleFlight retrieval to get stored snapshot', async () => {
            const streamKey = 'test-stream'
            const storedSnapshot = {
                id: 'stored-id',
                name: 'Stored Snapshot',
                value: 200,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            // Set up expired cache to force singleFlight usage
            dataSource._snapshots[streamKey] = {
                id: 'expired-id',
                name: 'Expired Snapshot',
                value: 300,
                createdAt: 100000000,
                expiresAt: 99999999 // Expired
            }
            
            // Mock loadSnapshotFromStore to return undefined first (no stored snapshot)
            // then return the stored snapshot for retrieval
            jest.spyOn(dataSource, 'loadSnapshotFromStore')
                .mockResolvedValueOnce(undefined) // First call (checking store)
                .mockResolvedValueOnce(storedSnapshot) // Second call (retrieval)
            
            await dataSource.getSnapshot(streamKey)
            
            // Verify singleFlight was called
            expect(mockSingleFlight).toHaveBeenCalledTimes(1)
            
            const singleFlightCall = mockSingleFlight.mock.calls[0][0]
            const retrieval = singleFlightCall.retrieval
            
            // Test the retrieval function
            const result = await retrieval()
            
            expect(dataSource.loadSnapshotFromStore).toHaveBeenCalledWith(streamKey)
            expect(result).toBe(storedSnapshot)
        })

        it('should throw error if retrieval finds no snapshot after computation', async () => {
            const streamKey = 'test-stream'
            
            // Mock loadSnapshotFromStore to return undefined for retrieval
            jest.spyOn(dataSource, 'loadSnapshotFromStore').mockResolvedValue(undefined)
            
            await dataSource.getSnapshot(streamKey)
            
            const singleFlightCall = mockSingleFlight.mock.calls[0][0]
            const retrieval = singleFlightCall.retrieval
            
            // Test the retrieval function when no snapshot is found
            await expect(retrieval()).rejects.toThrow('Snapshot not found after computation completed')
        })
    })

    describe('storeSnapshotToStore', () => {
        it('should store snapshot with correct primary key and DataCategory', async () => {
            const streamKey = 'test-stream'
            const snapshot: SnapshotType<TestSnapshotPayload> = {
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            await dataSource.storeSnapshotToStore({ streamKey, snapshot })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'Meta::Snapshot',
                snapshotHeader: {
                    dataSourceKey: 'mtw.testDataSource',
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    replayAt: 100000000,
                    type: 'Snapshot'
                },
                snapshotUpdate: {
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42
                }
            })
        })

        it('should use different primary key names based on constructor', async () => {
            const dataSourceWithDifferentKey = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'EphemeraId',
                dataSourceKey: 'mtw.differentDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            
            const streamKey = 'test-stream'
            const snapshot: SnapshotType<TestSnapshotPayload> = {
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            await dataSourceWithDifferentKey.storeSnapshotToStore({ streamKey, snapshot })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                EphemeraId: 'STREAM#mtw.differentDataSource::test-stream',
                DataCategory: 'Meta::Snapshot',
                snapshotHeader: {
                    dataSourceKey: 'mtw.differentDataSource',
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    replayAt: 100000000,
                    type: 'Snapshot'
                },
                snapshotUpdate: {
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42
                }
            })
        })

    })

    describe('loadSnapshotFromStore', () => {
        it('should load snapshot with correct primary key and DataCategory', async () => {
            const streamKey = 'test-stream'
            const storedSnapshot = {
                id: 'stored-id',
                name: 'Stored Snapshot',
                value: 200
            }
            
            mockDynamo.getItem.mockResolvedValue({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'Meta::Snapshot',
                snapshotHeader: {
                    dataSourceKey: 'mtw.testDataSource',
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'Snapshot'
                },
                snapshotUpdate: storedSnapshot
            })
            
            const result = await dataSource.loadSnapshotFromStore(streamKey)
            
            expect(mockDynamo.getItem).toHaveBeenCalledWith({
                Key: {
                    AssetId: 'STREAM#mtw.testDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot'
                },
                ProjectionFields: ['snapshotHeader', 'snapshotUpdate', 'snapshot']
            })
            expect(result).toEqual({
                ...storedSnapshot,
                type: 'Snapshot',
                createdAt: 100000000,
                replayAt: 100000000,
                expiresAt: 100300000
            })
        })

        it('should return undefined when no snapshot is found', async () => {
            const streamKey = 'test-stream'
            
            mockDynamo.getItem.mockResolvedValue(undefined)
            
            const result = await dataSource.loadSnapshotFromStore(streamKey)
            
            expect(mockDynamo.getItem).toHaveBeenCalledWith({
                Key: {
                    AssetId: 'STREAM#mtw.testDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot'
                },
                ProjectionFields: ['snapshotHeader', 'snapshotUpdate', 'snapshot']
            })
            expect(result).toBeUndefined()
        })

        it('should use different primary key names based on constructor', async () => {
            const dataSourceWithDifferentKey = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'EphemeraId',
                dataSourceKey: 'mtw.differentDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            
            const streamKey = 'test-stream'
            const storedSnapshot = {
                id: 'stored-id',
                name: 'Stored Snapshot',
                value: 200
            }
            
            mockDynamo.getItem.mockResolvedValue({
                EphemeraId: 'STREAM#mtw.differentDataSource::test-stream',
                DataCategory: 'Meta::Snapshot',
                snapshotHeader: {
                    dataSourceKey: 'mtw.differentDataSource',
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'Snapshot'
                },
                snapshotUpdate: storedSnapshot
            })
            
            const result = await dataSourceWithDifferentKey.loadSnapshotFromStore(streamKey)
            
            expect(mockDynamo.getItem).toHaveBeenCalledWith({
                Key: {
                    EphemeraId: 'STREAM#mtw.differentDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot'
                },
                ProjectionFields: ['snapshotHeader', 'snapshotUpdate', 'snapshot']
            })
            expect(result).toEqual({
                ...storedSnapshot,
                type: 'Snapshot',
                createdAt: 100000000,
                replayAt: 100000000,
                expiresAt: 100300000
            })
        })

        it('should prefer replayAt from snapshot header when loading envelope shape', async () => {
            const streamKey = 'test-stream'
            const storedSnapshot = {
                id: 'stored-id',
                name: 'Stored Snapshot',
                value: 200
            }

            mockDynamo.getItem.mockResolvedValue({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'Meta::Snapshot',
                snapshotHeader: {
                    dataSourceKey: 'mtw.testDataSource',
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    replayAt: 100002000,
                    type: 'Snapshot'
                },
                snapshotUpdate: storedSnapshot
            })

            const result = await dataSource.loadSnapshotFromStore(streamKey)
            expect(result).toEqual({
                ...storedSnapshot,
                type: 'Snapshot',
                createdAt: 100000000,
                replayAt: 100002000,
                expiresAt: 100300000
            })
        })

        it('should handle DynamoDB errors by letting them bubble up', async () => {
            const streamKey = 'test-stream'
            const dynamoError = new Error('DynamoDB connection failed')
            
            mockDynamo.getItem.mockRejectedValue(dynamoError)
            
            await expect(dataSource.loadSnapshotFromStore(streamKey)).rejects.toThrow('DynamoDB connection failed')
        })
    })

    describe('streamEvent', () => {
        beforeEach(() => {
            // Reset the mock to return predictable values
            mockUuidv4.mockReturnValue('test-uuid-123' as unknown as ReturnType<typeof uuidv4>)
        })

        afterEach(() => {
            jest.clearAllMocks()
        })

        it('should store event to DynamoDB and publish to EventBridge in parallel', async () => {
            await dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' }
            })
            
            // Verify DynamoDB putItem was called with correct event record
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::test-uuid-123',
                eventType: 'TestUpdatePayload',
                update: {
                    type: 'TestUpdatePayload',
                    update: 'test-update'
                }
            })
            
            // Verify EventBridge send was called with correct event
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.testDataSource',
                DetailType: 'TestUpdatePayload',
                Detail: {
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload',
                    update: 'test-update'
                }
            }])
        })

        it('should handle object update payloads correctly', async () => {
            await dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' }
            })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::test-uuid-123',
                eventType: 'TestUpdatePayload',
                update: {
                    type: 'TestUpdatePayload',
                    update: 'test-update'
                }
            })
            
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.testDataSource',
                DetailType: 'TestUpdatePayload',
                Detail: {
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload',
                    update: 'test-update',
                }
            }])
        })

        it('should use different primary key names based on constructor', async () => {
            const dataSourceWithDifferentKey = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'EphemeraId',
                dataSourceKey: 'mtw.differentDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            
            await dataSourceWithDifferentKey.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' }
            })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                EphemeraId: 'STREAM#mtw.differentDataSource::test-stream',
                DataCategory: 'EVENT#100000000::test-uuid-123',
                eventType: 'TestUpdatePayload',
                update: {
                    type: 'TestUpdatePayload',
                    update: 'test-update'
                }
            })
            
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.differentDataSource',
                DetailType: 'TestUpdatePayload',
                Detail: {
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload',
                    update: 'test-update',
                }
            }])
        })

        it('should handle parallel execution failures gracefully', async () => {
            // Make DynamoDB operation fail
            mockDynamo.putItem.mockRejectedValueOnce(new Error('DynamoDB error'))
            
            await expect(dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' }
            })).rejects.toThrow('DynamoDB error')
            
            // Verify EventBridge was still called (parallel execution)
            expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(1)
        })

        it('should handle EventBridge failures gracefully', async () => {
            // Make EventBridge operation fail
            mockEventBridgeClient.send.mockRejectedValueOnce(new Error('EventBridge error'))
            
            await expect(dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' }
            })).rejects.toThrow('EventBridge error')
            
            // Verify DynamoDB was still called (parallel execution)
            expect(mockDynamo.putItem).toHaveBeenCalledTimes(1)
        })

        it('should generate unique event IDs for different calls', async () => {
            const streamKey = 'test-stream'
            const update = {
                type: 'TestUpdatePayload' as const,
                update: 'test-update'
            }
            
            // Mock different UUIDs for different calls
            mockUuidv4
                .mockReturnValueOnce('uuid-1' as unknown as ReturnType<typeof uuidv4>)
                .mockReturnValueOnce('uuid-2' as unknown as ReturnType<typeof uuidv4>)
            
            await dataSource.streamEvent({ update, streamKey, header: { type: 'TestUpdatePayload' } })
            await dataSource.streamEvent({ update, streamKey, header: { type: 'TestUpdatePayload' } })
            
            expect(mockDynamo.putItem).toHaveBeenNthCalledWith(1, {
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::uuid-1',
                eventType: 'TestUpdatePayload',
                update: {
                    type: 'TestUpdatePayload',
                    update: 'test-update'
                }
            })
            
            expect(mockDynamo.putItem).toHaveBeenNthCalledWith(2, {
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::uuid-2',
                eventType: 'TestUpdatePayload',
                update: {
                    type: 'TestUpdatePayload',
                    update: 'test-update'
                }
            })
        })

        it('should use current timestamp from getCurrentTimestamp', async () => {
            // Mock different timestamp
            mockGetCurrentTimestamp.mockReturnValueOnce(200000000)
            
            await dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' }
            })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#200000000::test-uuid-123',
                eventType: 'TestUpdatePayload',
                update: {
                    type: 'TestUpdatePayload',
                    update: 'test-update'
                }
            })
            
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.testDataSource',
                DetailType: 'TestUpdatePayload',
                Detail: {
                    streamKey: 'test-stream',
                    timestamp: 200000000,
                    type: 'TestUpdatePayload',
                    update: 'test-update',
                }
            }])
        })

        it('should publish to messageBus for internal event coordination', async () => {
            await dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' }
            })
            
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'StreamingEvent',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                header: {
                    dataSourceKey: 'mtw.testDataSource',
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload'
                },
                getContent: expect.any(Function),
                timestamp: 100000000
            })

            const sendCall = mockMessageBus.publish.mock.calls[0][0]
            const content = await sendCall.getContent()
            expect(content).toEqual({
                type: 'TestUpdatePayload',
                update: 'test-update'
            })
            // getContent('external') returns coreFormat.update (external format)
            const external = await sendCall.getContent('external')
            expect(external).toEqual({
                type: 'TestUpdatePayload',
                update: 'test-update'
            })
        })

        it('should merge required header fragment with DataSource-owned header', async () => {
            await dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'SomeType' }
            })

            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
            const sent = mockMessageBus.publish.mock.calls[0][0]
            expect(sent.header).toMatchObject({
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                timestamp: 100000000,
                type: 'SomeType'
            })
        })

    })

    describe('streamEnvelope', () => {
        beforeEach(() => {
            mockUuidv4.mockReturnValue('test-uuid-123' as unknown as ReturnType<typeof uuidv4>)
        })

        afterEach(() => {
            jest.clearAllMocks()
        })

        it('should store external-origin envelope with sidecarred payload and preserve sidecar', async () => {
            const externalPayloadWithSidecar = {
                type: 'Content Update' as const,
                wml: { sidecarUrl: 's3://bucket/key' },
            }
            const coreFormat = {
                header: {
                    dataSourceKey: 'mtw.wml' as const,
                    streamKey: 'ZONE#test-zone',
                    timestamp: 100000000,
                    type: 'Content Update' as const,
                },
                update: externalPayloadWithSidecar,
            }
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () => Promise.resolve({ internal: 'content' }))

            await dataSource.streamEnvelope(envelope)

            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.wml::ZONE#test-zone',
                DataCategory: 'EVENT#100000000::test-uuid-123',
                eventType: 'Content Update',
                update: externalPayloadWithSidecar,
            })
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.wml',
                DetailType: 'Content Update',
                Detail: expect.objectContaining({
                    streamKey: 'ZONE#test-zone',
                    timestamp: 100000000,
                    wml: { sidecarUrl: 's3://bucket/key' },
                }),
            }])
            expect(mockMessageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
                type: 'StreamingEvent',
                dataSourceKey: 'mtw.wml',
                streamKey: 'ZONE#test-zone',
                timestamp: 100000000,
                header: coreFormat.header,
            }))
            const messageBusPayload = mockMessageBus.publish.mock.calls[0][0]
            expect(messageBusPayload.getContent).toBe(envelope.getContent)
        })

        it('should not call putItem when DataSource is non-replayable', async () => {
            const nonReplayableDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                replayable: false,
            })
            const coreFormat = {
                header: {
                    dataSourceKey: 'mtw.testDataSource' as const,
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload' as const,
                },
                update: { type: 'TestUpdatePayload', update: 'test-update' },
            }
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () => Promise.resolve({ type: 'TestUpdatePayload', update: 'test-update' }))

            await nonReplayableDataSource.streamEnvelope(envelope)

            expect(mockDynamo.putItem).not.toHaveBeenCalled()
            expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(1)
            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        })

        it('should generate unique event IDs for different streamEnvelope calls', async () => {
            const coreFormat = {
                header: {
                    dataSourceKey: 'mtw.testDataSource' as const,
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload' as const,
                },
                update: { type: 'TestUpdatePayload', update: 'test-update' },
            }
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () => Promise.resolve({ type: 'TestUpdatePayload', update: 'test-update' }))

            mockUuidv4
                .mockReturnValueOnce('uuid-a' as unknown as ReturnType<typeof uuidv4>)
                .mockReturnValueOnce('uuid-b' as unknown as ReturnType<typeof uuidv4>)

            await dataSource.streamEnvelope(envelope)
            await dataSource.streamEnvelope(envelope)

            expect(mockDynamo.putItem).toHaveBeenNthCalledWith(1, expect.objectContaining({
                DataCategory: 'EVENT#100000000::uuid-a',
            }))
            expect(mockDynamo.putItem).toHaveBeenNthCalledWith(2, expect.objectContaining({
                DataCategory: 'EVENT#100000000::uuid-b',
            }))
        })
    })

    describe('initializeSubscription', () => {
        it('should prefer replayAt over createdAt for replay cursor', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'

            jest.spyOn(dataSource, 'getSnapshotExternal').mockResolvedValue({
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                replayAt: 100002000,
                expiresAt: 100005000
            })
            mockDynamo.query.mockResolvedValue([])

            await dataSource.initializeSubscription({ sessionId, streamKey })

            expect(mockDynamo.query).toHaveBeenCalledWith(expect.objectContaining({
                ExpressionAttributeValues: expect.objectContaining({
                    ':timestampPrefix': 'EVENT#100002000'
                })
            }))
        })

        it('should fall back to createdAt when replayAt is missing', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'

            jest.spyOn(dataSource, 'getSnapshotExternal').mockResolvedValue({
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100005000
            })
            mockDynamo.query.mockResolvedValue([])

            await dataSource.initializeSubscription({ sessionId, streamKey })

            expect(mockDynamo.query).toHaveBeenCalledWith(expect.objectContaining({
                ExpressionAttributeValues: expect.objectContaining({
                    ':timestampPrefix': 'EVENT#100000000'
                })
            }))
        })

        it('should not log replay diagnostics when sample rate is 0', async () => {
            const previousSampleRate = process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE
            process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE = '0'
            const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'

            jest.spyOn(dataSource, 'getSnapshotExternal').mockResolvedValue({
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                replayAt: 100002000,
                expiresAt: 100005000
            })
            mockDynamo.query.mockResolvedValue([])

            try {
                await dataSource.initializeSubscription({ sessionId, streamKey })
                expect(infoSpy).not.toHaveBeenCalled()
            }
            finally {
                infoSpy.mockRestore()
                if (previousSampleRate === undefined) {
                    delete process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE
                } else {
                    process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE = previousSampleRate
                }
            }
        })

        it('should log replay diagnostics when sample rate is 1', async () => {
            const previousSampleRate = process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE
            process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE = '1'
            const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'

            jest.spyOn(dataSource, 'getSnapshotExternal').mockResolvedValue({
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100010000,
                replayAt: 100000000,
                expiresAt: 100015000
            })
            const primaryKey = `STREAM#mtw.testDataSource::${streamKey}`
            mockDynamo.query.mockResolvedValue([
                {
                    AssetId: primaryKey,
                    DataCategory: 'EVENT#100005000::event-1',
                    eventType: 'TestUpdatePayload',
                    update: { type: 'TestUpdatePayload', update: 'event-1' }
                },
                {
                    AssetId: primaryKey,
                    DataCategory: 'EVENT#100008000::event-2',
                    eventType: 'TestUpdatePayload',
                    update: { type: 'TestUpdatePayload', update: 'event-2' }
                }
            ])

            try {
                await dataSource.initializeSubscription({ sessionId, streamKey })
                expect(infoSpy).toHaveBeenCalledTimes(1)
                const [prefix, payload] = infoSpy.mock.calls[0]
                expect(prefix).toBe('[DataSourceReplaySubscribe]')
                expect(JSON.parse(payload)).toMatchObject({
                    dataSourceKey: 'mtw.testDataSource',
                    streamKey,
                    sessionId,
                    createdAt: 100010000,
                    replayAt: 100000000,
                    replayCursor: 100000000,
                    replayEventCount: 2,
                    replayWindowLower: 100000000,
                    replayWindowFirst: 100005000,
                    replayWindowLatest: 100008000
                })
            }
            finally {
                infoSpy.mockRestore()
                if (previousSampleRate === undefined) {
                    delete process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE
                } else {
                    process.env.MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE = previousSampleRate
                }
            }
        })

        it('replays gap events when replayAt is older than createdAt (historical snapshot watermark)', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'
            const replayAt = 100000000
            const createdAt = 100010000

            const getSnapshotSpy = jest.spyOn(dataSource, 'getSnapshotExternal').mockResolvedValue({
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt,
                replayAt,
                expiresAt: 200000000
            })

            const primaryKey = `STREAM#mtw.testDataSource::${streamKey}`
            mockDynamo.query.mockImplementation((args: { ExpressionAttributeValues?: { ':timestampPrefix'?: string } }) => {
                const prefix = args.ExpressionAttributeValues?.[':timestampPrefix']
                if (prefix === `EVENT#${createdAt}`) {
                    return Promise.resolve([])
                }
                if (prefix === `EVENT#${replayAt}`) {
                    return Promise.resolve([
                        {
                            AssetId: primaryKey,
                            DataCategory: 'EVENT#100005000::gap-1',
                            eventType: 'TestUpdatePayload',
                            update: { type: 'TestUpdatePayload', update: 'gap-1' }
                        },
                        {
                            AssetId: primaryKey,
                            DataCategory: 'EVENT#100008000::gap-2',
                            eventType: 'TestUpdatePayload',
                            update: { type: 'TestUpdatePayload', update: 'gap-2' }
                        }
                    ])
                }
                return Promise.resolve([])
            })

            await dataSource.initializeSubscription({ sessionId, streamKey })

            expect(mockDynamo.query).toHaveBeenCalledWith(expect.objectContaining({
                ExpressionAttributeValues: expect.objectContaining({
                    ':timestampPrefix': `EVENT#${replayAt}`
                })
            }))
            expect(mockSns.send).toHaveBeenCalledTimes(3)

            const event1 = JSON.parse(mockSns.send.mock.calls[1][0].Message)
            const event2 = JSON.parse(mockSns.send.mock.calls[2][0].Message)
            expect(event1).toMatchObject({
                messageType: 'StreamEvent',
                update: { type: 'TestUpdatePayload', update: 'gap-1' }
            })
            expect(event2).toMatchObject({
                messageType: 'StreamEvent',
                update: { type: 'TestUpdatePayload', update: 'gap-2' }
            })

            getSnapshotSpy.mockRestore()
        })

        it('should deliver snapshot and events via SNS', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'
            
            // Mock getSnapshot to return a snapshot
            const mockSnapshot = {
                type: 'Snapshot',
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100005000
            }
            
            // Mock the getSnapshot method by setting up the cache
            dataSource._snapshots[streamKey] = mockSnapshot
            
            // Mock DynamoDB query to return raw events (with DataCategory)
            const mockEvents = [
                { update: { type: 'TestUpdatePayload', update: 'test-update-1' }, DataCategory: 'EVENT#100001000::event-1', streamKey: 'test-stream' },
                { update: { type: 'TestUpdatePayload', update: 'test-update-2' }, DataCategory: 'EVENT#100002000::event-2', streamKey: 'test-stream' }
            ]
            
            // Mock the query method to return events
            mockDynamo.query.mockResolvedValue(mockEvents)
            
            await dataSource.initializeSubscription({ sessionId, streamKey })
            
            // Verify SNS was called 3 times (1 snapshot + 2 events)
            expect(mockSns.send).toHaveBeenCalledTimes(3)
            
            // Verify snapshot message
            const snapshotCall = mockSns.send.mock.calls[0][0]
            expect(snapshotCall.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-feedback')
            const snapshotMessage = JSON.parse(snapshotCall.Message)
            // Snapshot is now delivered using SNS Feedback format (flat structure)
            expect(snapshotMessage).toMatchObject({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                update: {
                    type: 'Snapshot',
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42
                }
            })
            expect(snapshotCall.MessageAttributes.Targets.StringValue).toBe(JSON.stringify([sessionId]))
            
            // Verify first event message
            const event1Call = mockSns.send.mock.calls[1][0]
            expect(event1Call.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-feedback')
            expect(JSON.parse(event1Call.Message)).toMatchObject({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update-1' }
            })
            expect(event1Call.MessageAttributes.Targets.StringValue).toBe(JSON.stringify([sessionId]))
            
            // Verify second event message
            const event2Call = mockSns.send.mock.calls[2][0]
            expect(event2Call.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-feedback')
            expect(JSON.parse(event2Call.Message)).toMatchObject({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update-2' }
            })
            expect(event2Call.MessageAttributes.Targets.StringValue).toBe(JSON.stringify([sessionId]))
        })
        
        it('should handle case with no events', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'
            
            // Mock getSnapshot to return a snapshot
            const mockSnapshot = {
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100005000
            }
            
            dataSource._snapshots[streamKey] = mockSnapshot
            
            // Mock getRecentEvents to return no events
            mockDynamo.query.mockResolvedValue([])
            
            await dataSource.initializeSubscription({ sessionId, streamKey })
            
            // Should only call SNS once (snapshot only, no events)
            expect(mockSns.send).toHaveBeenCalledTimes(1)
            
            const snapshotCall = mockSns.send.mock.calls[0][0]
            // Snapshot is now delivered using SNS Feedback format (flat structure)
            expect(JSON.parse(snapshotCall.Message).messageType).toBe('StreamEvent')
            expect(JSON.parse(snapshotCall.Message)).toMatchObject({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                update: expect.any(Object)
            })
        })

        it('should deliver sidecar Snapshot when snapshot payload includes a sidecarUrl', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'
            const sidecarUrl = 'https://example.com/sidecar'
            const createdAt = 12345
            const expiresAt = 12346

            const sidecarDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                replayable: true
            })

            jest.spyOn(sidecarDataSource, 'getSnapshotExternal').mockResolvedValue({
                type: 'Snapshot',
                sidecarUrl,
                createdAt,
                expiresAt
            } as any)
            mockDynamo.query.mockResolvedValue([])

            await sidecarDataSource.initializeSubscription({ sessionId, streamKey })

            expect(mockSns.send).toHaveBeenCalledTimes(1)
            const snapshotCall = mockSns.send.mock.calls[0][0]
            const snapshotMessage = JSON.parse(snapshotCall.Message)
            expect(snapshotMessage).toMatchObject({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                timestamp: createdAt,
                update: {
                    type: 'Snapshot',
                    sidecarUrl
                }
            })
            expect(snapshotCall.MessageAttributes.Targets.StringValue).toBe(JSON.stringify([sessionId]))
        })

        it('should put replayAt on extendedHeader and not in update when snapshot has replayAt', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'
            const createdAt = 100000000
            const replayAt = 80000

            jest.spyOn(dataSource, 'getSnapshotExternal').mockResolvedValue({
                type: 'Snapshot',
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt,
                replayAt,
                expiresAt: 100005000
            } as any)
            mockDynamo.query.mockResolvedValue([])

            await dataSource.initializeSubscription({ sessionId, streamKey })

            expect(mockSns.send).toHaveBeenCalledTimes(1)
            const snapshotMessage = JSON.parse(mockSns.send.mock.calls[0][0].Message)
            expect(snapshotMessage.extendedHeader).toEqual({ replayAt })
            expect(snapshotMessage.update.replayAt).toBeUndefined()
            expect(snapshotMessage.update).toMatchObject({
                type: 'Snapshot',
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42
            })
        })

        it('should omit extendedHeader.replayAt when snapshot has no replayAt', async () => {
            const sessionId = 'SESSION#test-session' as const
            const streamKey = 'test-stream'

            jest.spyOn(dataSource, 'getSnapshotExternal').mockResolvedValue({
                type: 'Snapshot',
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100005000
            } as any)
            mockDynamo.query.mockResolvedValue([])

            await dataSource.initializeSubscription({ sessionId, streamKey })

            expect(mockSns.send).toHaveBeenCalledTimes(1)
            const snapshotMessage = JSON.parse(mockSns.send.mock.calls[0][0].Message)
            expect(snapshotMessage.extendedHeader?.replayAt).toBeUndefined()
            expect(snapshotMessage.update.replayAt).toBeUndefined()
            expect(snapshotMessage.update).toMatchObject({
                type: 'Snapshot',
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42
            })
        })
    })

    describe('type safety', () => {
        it('resolveReplayCursorTimestamp should use replayAt then createdAt fallback', () => {
            expect(resolveReplayCursorTimestamp({ createdAt: 100, replayAt: 250 })).toBe(250)
            expect(resolveReplayCursorTimestamp({ createdAt: 100 })).toBe(100)
        })

        it('should work with different SerializableObject types', () => {
            type ComplexSnapshot = {
                id: string
                metadata: {
                    version: number
                    tags: string[]
                }
                data: Record<string, unknown>
            }
            
            const complexDataSource = new TestDataSource<ComplexSnapshot, { type: 'ComplexUpdatePayload', update: string }>({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.complexDataSource',
                snapshotContentGenerator: jest.fn().mockResolvedValue({
                    id: 'complex-id',
                    metadata: { version: 1, tags: ['test'] },
                    data: { key: 'value' }
                }),
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            
            expect(complexDataSource).toBeDefined()
        })

        it('should work with object UpdatePayload', () => {
            type ObjectUpdate = {
                type: 'ObjectUpdatePayload';
                update: unknown;
            }
            
            const objectUpdateDataSource = new TestDataSource<TestSnapshotPayload, ObjectUpdate>({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.objectUpdateDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            
            expect(objectUpdateDataSource).toBeDefined()
        })

        it('should support custom Header and buildHeader for extended header shape', async () => {
            type ExtendedHeader = StreamingEventHeader & { zone?: string }
            const dataSourceWithExtendedHeader = new DataSource<
                TestSnapshotPayload,
                TestUpdatePayload,
                never,
                TestUpdatePayload,
                'AssetId',
                TestSnapshotPayload,
                ExtendedHeader
            >({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.extendedHeader',
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                buildHeader: ({ streamKey, timestamp }) => ({
                    dataSourceKey: 'mtw.extendedHeader',
                    streamKey,
                    timestamp,
                    type: 'TestUpdatePayload',
                    zone: 'Draft'
                })
            })
            await dataSourceWithExtendedHeader.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test' },
                streamKey: 'stream-1',
                header: { type: 'TestUpdatePayload', zone: 'Draft' }
            })
            const sent = mockMessageBus.publish.mock.calls[0][0]
            expect(sent.header).toMatchObject({
                dataSourceKey: 'mtw.extendedHeader',
                streamKey: 'stream-1',
                type: 'TestUpdatePayload',
                zone: 'Draft'
            })
        })

        it('should merge header fragment with extended fields when provided', async () => {
            type ExtendedHeader = StreamingEventHeader & { zone?: string }
            const dataSourceWithExtendedHeader = new DataSource<
                TestSnapshotPayload,
                TestUpdatePayload,
                never,
                TestUpdatePayload,
                'AssetId',
                TestSnapshotPayload,
                ExtendedHeader
            >({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.extendedHeader',
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            await dataSourceWithExtendedHeader.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test' },
                streamKey: 'stream-1',
                header: { type: 'ExplicitType', zone: 'Canon' }
            })
            const sent = mockMessageBus.publish.mock.calls[0][0]
            expect(sent.header).toMatchObject({
                dataSourceKey: 'mtw.extendedHeader',
                streamKey: 'stream-1',
                type: 'ExplicitType',
                zone: 'Canon'
            })
        })

        it('should send Detail.extendedHeader to EventBridge when header has extended fields', async () => {
            type ExtendedHeader = StreamingEventHeader & { zone?: string }
            const dataSourceWithExtendedHeader = new DataSource<
                TestSnapshotPayload,
                TestUpdatePayload,
                never,
                TestUpdatePayload,
                'AssetId',
                TestSnapshotPayload,
                ExtendedHeader
            >({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.extendedHeader',
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            await dataSourceWithExtendedHeader.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test' },
                streamKey: 'stream-1',
                header: { type: 'TestUpdatePayload', zone: 'Draft' }
            })
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([expect.objectContaining({
                Source: 'mtw.extendedHeader',
                DetailType: 'TestUpdatePayload',
                Detail: expect.objectContaining({
                    streamKey: 'stream-1',
                    extendedHeader: { zone: 'Draft' },
                    update: 'test'
                })
            })])
        })
    })

    describe('subscription functionality', () => {
        let mockMessageBus: any
        let mockReceiveEvents: jest.MockedFunction<any>
        let mockSubscribedEventTypeGuard: jest.MockedFunction<any>

        beforeEach(() => {
            // Mock messageBus
            mockMessageBus = {
                subscribe: jest.fn()
            }

            // Mock receiveEvents function
            mockReceiveEvents = jest.fn().mockResolvedValue(undefined)

            // Mock envelope type guard (envelope: StreamingEventEnvelope<unknown>) => boolean
            mockSubscribedEventTypeGuard = jest.fn().mockReturnValue(true)

            // Reset mocks
            jest.clearAllMocks()
        })

        // Subscription filter receives messageBus payloads; when they have header/content, the
        // filter passes StreamingEventHeader to subscribedEventTypeGuard and the callback passes
        // StreamingEventEnvelope[] to receiveEvents.
        describe('subscribe', () => {
            it('should subscribe to Initialize events even if subscribedEventTypeGuard is not provided (for replayable DataSources)', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    receiveEvents: mockReceiveEvents
                    // No subscribedEventTypeGuard provided
                })

                dataSource.subscribe()

                // Should subscribe to Initialize events for replayable DataSources
                expect(mockMessageBus.subscribe).toHaveBeenCalledTimes(1)
                expect(mockMessageBus.subscribe).toHaveBeenCalledWith({
                    tag: 'dataSource-mtw.testDataSource-initialize',
                    priority: 1,
                    filter: expect.any(Function),
                    callback: expect.any(Function)
                })
            })

            it('should subscribe to Initialize events even if receiveEvents is not provided (for replayable DataSources)', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard
                    // No receiveEvents provided
                })

                dataSource.subscribe()

                // Should subscribe to Initialize events for replayable DataSources
                expect(mockMessageBus.subscribe).toHaveBeenCalledTimes(1)
                expect(mockMessageBus.subscribe).toHaveBeenCalledWith({
                    tag: 'dataSource-mtw.testDataSource-initialize',
                    priority: 1,
                    filter: expect.any(Function),
                    callback: expect.any(Function)
                })
            })

            it('should subscribe to messageBus with correct configuration (both Initialize and regular events)', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: mockReceiveEvents
                })

                dataSource.subscribe()

                // Should have two subscriptions: Initialize events and regular events
                expect(mockMessageBus.subscribe).toHaveBeenCalledTimes(2)
                
                // Check Initialize subscription
                expect(mockMessageBus.subscribe).toHaveBeenCalledWith({
                    tag: 'dataSource-mtw.testDataSource-initialize',
                    priority: 1,
                    filter: expect.any(Function),
                    callback: expect.any(Function)
                })
                
                // Check regular events subscription
                expect(mockMessageBus.subscribe).toHaveBeenCalledWith({
                    tag: 'dataSource-mtw.testDataSource',
                    priority: 5,
                    filter: expect.any(Function),
                    callback: expect.any(Function)
                })
            })

            it('should allow overriding regular subscription priority', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: mockReceiveEvents,
                    subscriptionPriority: 20
                })

                dataSource.subscribe()

                expect(mockMessageBus.subscribe).toHaveBeenCalledWith({
                    tag: 'dataSource-mtw.testDataSource',
                    priority: 20,
                    filter: expect.any(Function),
                    callback: expect.any(Function)
                })
            })

            it('should use structure guard for filter and envelope guard in callback', async () => {
                // Envelope guard: same logic as before but receives envelope with .header
                mockSubscribedEventTypeGuard.mockImplementation((envelope: { header: { dataSourceKey: string; type: string; streamKey: string } }) => {
                    if (envelope.header.dataSourceKey === 'mtw.assets') {
                        return envelope.header.type === 'AssetUpdated' && envelope.header.streamKey.startsWith('char-')
                    }
                    if (envelope.header.dataSourceKey === 'mtw.ephemera') {
                        return envelope.header.type === 'StateChanged' && envelope.header.streamKey === 'zone-123'
                    }
                    return false
                })

                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: mockReceiveEvents
                })

                dataSource.subscribe()

                const regularSubscription = mockMessageBus.subscribe.mock.calls.find((call: any) =>
                    call[0].tag === 'dataSource-mtw.testDataSource'
                )
                const structureGuard = regularSubscription[0].filter
                const callback = regularSubscription[0].callback

                // Structure guard accepts valid streaming events (does not call envelope guard)
                const validEvent = {
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'char-123',
                    header: { dataSourceKey: 'mtw.assets', streamKey: 'char-123', timestamp: 123456789, type: 'AssetUpdated' },
                    getContent: () => Promise.resolve({ type: 'AssetUpdated', assetId: 'char-123' }),
                    timestamp: 123456789
                }
                expect(structureGuard(validEvent)).toBe(true)

                const wrongMessageType = {
                    type: 'OtherEvent',
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'char-123',
                    header: { dataSourceKey: 'mtw.assets', streamKey: 'char-123', timestamp: 123456789, type: 'AssetUpdated' },
                    timestamp: 123456789
                }
                expect(structureGuard(wrongMessageType)).toBe(false)

                // Callback builds envelopes and filters with envelope guard; only matching events reach receiveEvents
                const payloads = [
                    validEvent,
                    {
                        type: 'StreamingEvent',
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'item-456',
                        header: { dataSourceKey: 'mtw.assets', streamKey: 'item-456', timestamp: 123456789, type: 'AssetUpdated' },
                        getContent: () => Promise.resolve({ type: 'AssetUpdated', assetId: 'item-456' }),
                        timestamp: 123456789
                    }
                ]
                await callback({ payloads, messageBus: mockMessageBus as any })

                expect(mockSubscribedEventTypeGuard).toHaveBeenCalledTimes(2)
                expect(mockSubscribedEventTypeGuard).toHaveBeenNthCalledWith(1, expect.objectContaining({
                    header: expect.objectContaining({ dataSourceKey: 'mtw.assets', streamKey: 'char-123', type: 'AssetUpdated' })
                }))
                expect(mockSubscribedEventTypeGuard).toHaveBeenNthCalledWith(2, expect.objectContaining({
                    header: expect.objectContaining({ dataSourceKey: 'mtw.assets', streamKey: 'item-456', type: 'AssetUpdated' })
                }))
                expect(mockReceiveEvents).toHaveBeenCalledWith(expect.objectContaining({
                    events: expect.arrayContaining([
                        expect.objectContaining({ header: expect.objectContaining({ streamKey: 'char-123' }), getContent: expect.any(Function) })
                    ]),
                    streamEvent: expect.any(Function),
                    streamEnvelope: expect.any(Function)
                }))
                expect(mockReceiveEvents.mock.calls[0][0].events).toHaveLength(1)
            })

            it('should call receiveEvents with batch of filtered events', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: mockReceiveEvents
                })

                dataSource.subscribe()

                // Find the regular events subscription (not the Initialize subscription)
                const regularSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.testDataSource'
                )
                const callback = regularSubscription[0].callback

                // Mock streamEvent method
                const mockStreamEvent = jest.spyOn(dataSource, 'streamEvent').mockResolvedValue(undefined)

                // Test callback with multiple events from other data sources
                const testEvents = [
                    {
                        type: 'StreamingEvent',
                        dataSourceKey: 'mtw.otherDataSource',
                        streamKey: 'test-stream',
                        header: {
                            dataSourceKey: 'mtw.otherDataSource',
                            streamKey: 'test-stream',
                            timestamp: 123456789,
                            type: 'event1'
                        },
                        getContent: () => Promise.resolve({ type: 'event1', data: 'test1' }),
                        timestamp: 123456789
                    },
                    {
                        type: 'StreamingEvent',
                        dataSourceKey: 'mtw.anotherDataSource',
                        streamKey: 'test-stream',
                        header: {
                            dataSourceKey: 'mtw.anotherDataSource',
                            streamKey: 'test-stream',
                            timestamp: 123456790,
                            type: 'event2'
                        },
                        getContent: () => Promise.resolve({ type: 'event2', data: 'test2' }),
                        timestamp: 123456790
                    }
                ]

                await callback({ payloads: testEvents, messageBus: mockMessageBus as any })

                // Should be called once with array of events
                expect(mockReceiveEvents).toHaveBeenCalledTimes(1)
                expect(mockReceiveEvents).toHaveBeenCalledWith({
                    events: [
                        {
                            header: {
                                dataSourceKey: 'mtw.otherDataSource',
                                streamKey: 'test-stream',
                                timestamp: 123456789,
                                type: 'event1'
                            },
                            getContent: expect.any(Function)
                        },
                        {
                            header: {
                                dataSourceKey: 'mtw.anotherDataSource',
                                streamKey: 'test-stream',
                                timestamp: 123456790,
                                type: 'event2'
                            },
                            getContent: expect.any(Function)
                        }
                    ],
                    streamEvent: expect.any(Function),
                    streamEnvelope: expect.any(Function)
                })

                const receivedEvents = mockReceiveEvents.mock.calls[0][0].events
                expect(await receivedEvents[0].getContent()).toEqual({ type: 'event1', data: 'test1' })
                expect(await receivedEvents[1].getContent()).toEqual({ type: 'event2', data: 'test2' })

                // Test that streamEvent function works
                const streamEventFunction = mockReceiveEvents.mock.calls[0][0].streamEvent
                await streamEventFunction({
                    update: 'test-update',
                    streamKey: 'test-stream',
                    header: { type: 'Test Event' }
                })

                expect(mockStreamEvent).toHaveBeenCalledWith(expect.objectContaining({
                    update: 'test-update',
                    streamKey: 'test-stream',
                    header: { type: 'Test Event' },
                }))
            })

            it('should pass streamEnvelope to receiveEvents and forward to dataSource.streamEnvelope', async () => {
                const dataSourceWithSpy = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: mockReceiveEvents
                })
                const streamEnvelopeSpy = jest.spyOn(dataSourceWithSpy, 'streamEnvelope').mockResolvedValue(undefined)

                dataSourceWithSpy.subscribe()

                const regularSubscription = mockMessageBus.subscribe.mock.calls.find((call: any) =>
                    call[0].tag === 'dataSource-mtw.testDataSource'
                )
                const callback = regularSubscription[0].callback

                const testEvent = {
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.test',
                    streamKey: 'test-stream',
                    header: {
                        dataSourceKey: 'mtw.test',
                        streamKey: 'test-stream',
                        timestamp: 123456789,
                        type: 'event1'
                    },
                    getContent: () => Promise.resolve({ type: 'event1', data: 'test1' }),
                    timestamp: 123456789
                }

                await callback({ payloads: [testEvent], messageBus: mockMessageBus as any })

                const streamEnvelopeFn = mockReceiveEvents.mock.calls[0][0].streamEnvelope
                const envelope = {
                    header: testEvent.header,
                    getContent: testEvent.getContent
                }
                await streamEnvelopeFn(envelope)

                expect(streamEnvelopeSpy).toHaveBeenCalledWith(envelope)
            })

            it('should handle receiveEvents errors gracefully', async () => {
                const errorReceiveEvents = jest.fn().mockRejectedValue(new Error('Processing failed'))
                
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: errorReceiveEvents
                })

                dataSource.subscribe()

                // Find the regular events subscription (not the Initialize subscription)
                const regularSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.testDataSource'
                )
                const callback = regularSubscription[0].callback

                const testEvents = [
                    {
                        type: 'StreamingEvent',
                        dataSourceKey: 'mtw.otherDataSource',
                        streamKey: 'test-stream',
                        header: {
                            dataSourceKey: 'mtw.otherDataSource',
                            streamKey: 'test-stream',
                            timestamp: 123456789,
                            type: 'event1'
                        },
                        getContent: () => Promise.resolve({ type: 'event1' }),
                        timestamp: 123456789
                    }
                ]

                // Callback will reject if receiveEvents rejects
                await expect(callback({ payloads: testEvents, messageBus: mockMessageBus as any })).rejects.toThrow('Processing failed')
                expect(errorReceiveEvents).toHaveBeenCalledWith({
                    events: [
                        {
                            header: {
                                dataSourceKey: 'mtw.otherDataSource',
                                streamKey: 'test-stream',
                                timestamp: 123456789,
                                type: 'event1'
                            },
                            getContent: expect.any(Function)
                        }
                    ],
                    streamEvent: expect.any(Function),
                    streamEnvelope: expect.any(Function)
                })

                const receivedEvents = errorReceiveEvents.mock.calls[0][0].events
                expect(await receivedEvents[0].getContent()).toEqual({ type: 'event1' })
            })

            it('should handle empty event arrays gracefully', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: mockReceiveEvents
                })

                dataSource.subscribe()

                // Find the regular events subscription (not the Initialize subscription)
                const regularSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.testDataSource'
                )
                const callback = regularSubscription[0].callback

                // Test callback with empty array
                await callback({ payloads: [], messageBus: mockMessageBus as any })

                expect(mockReceiveEvents).toHaveBeenCalledWith({
                    events: [],
                    streamEvent: expect.any(Function),
                    streamEnvelope: expect.any(Function)
                })
            })

            it('should handle single event in batch', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    subscribedEventTypeGuard: mockSubscribedEventTypeGuard,
                    receiveEvents: mockReceiveEvents
                })

                dataSource.subscribe()

                // Find the regular events subscription (not the Initialize subscription)
                const regularSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.testDataSource'
                )
                const callback = regularSubscription[0].callback

                const testEvents = [
                    {
                        type: 'StreamingEvent',
                        dataSourceKey: 'mtw.singleDataSource',
                        streamKey: 'test-stream',
                        header: {
                            dataSourceKey: 'mtw.singleDataSource',
                            streamKey: 'test-stream',
                            timestamp: 123456789,
                            type: 'singleEvent'
                        },
                        getContent: () => Promise.resolve({ type: 'singleEvent', data: 'test' }),
                        timestamp: 123456789
                    }
                ]

                await callback({ payloads: testEvents, messageBus: mockMessageBus as any })

                expect(mockReceiveEvents).toHaveBeenCalledWith({
                    events: [
                        {
                            header: {
                                dataSourceKey: 'mtw.singleDataSource',
                                streamKey: 'test-stream',
                                timestamp: 123456789,
                                type: 'singleEvent'
                            },
                            getContent: expect.any(Function)
                        }
                    ],
                    streamEvent: expect.any(Function),
                    streamEnvelope: expect.any(Function)
                })

                const receivedEvents = mockReceiveEvents.mock.calls[0][0].events
                expect(await receivedEvents[0].getContent()).toEqual({ type: 'singleEvent', data: 'test' })
            })
        })

        describe('Initialize Subscription events for replayable DataSources', () => {
            it('should subscribe to Initialize Subscription events when replayable is true', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                dataSource.subscribe()

                // Should have one subscription: Initialize events (no regular event handlers provided)
                expect(mockMessageBus.subscribe).toHaveBeenCalledTimes(1)

                // Check Initialize Subscription subscription
                const initializeSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.assets.contentHeaders-initialize'
                )
                expect(initializeSubscription).toBeDefined()
                expect(initializeSubscription[0]).toMatchObject({
                    tag: 'dataSource-mtw.assets.contentHeaders-initialize',
                    priority: 1, // Higher priority than regular events
                    filter: expect.any(Function),
                    callback: expect.any(Function)
                })
            })

            it('should not subscribe to Initialize Subscription events when replayable is false', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                dataSource.subscribe()

                // Should have no subscriptions since replayable is false and no event handlers provided
                expect(mockMessageBus.subscribe).not.toHaveBeenCalled()
            })

            it('should create correct type guard for Initialize Subscription events', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                dataSource.subscribe()

                const initializeSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.assets.contentHeaders-initialize'
                )
                const typeGuard = initializeSubscription[0].filter

                // Test valid Initialize Subscription event
                const validEvent = {
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.subscriptions',
                    streamKey: 'test-stream',
                    header: {
                        dataSourceKey: 'mtw.subscriptions',
                        streamKey: 'test-stream',
                        timestamp: 123456789,
                        type: 'Initialize Subscription - mtw.assets.contentHeaders'
                    },
                    getContent: () => Promise.resolve({ sessionId: 'SESSION#test-session', requestId: 'test-request-123' }),
                    timestamp: 123456789
                }
                expect(typeGuard(validEvent)).toBe(true)

                // Test wrong dataSourceKey
                const wrongDataSourceKey = {
                    ...validEvent,
                    dataSourceKey: 'mtw.otherDataSource'
                }
                expect(typeGuard(wrongDataSourceKey)).toBe(false)

                // Test wrong event type
                const wrongEventType = {
                    ...validEvent,
                    header: {
                        ...validEvent.header,
                        type: 'Initialize Subscription - mtw.otherDataSource'
                    }
                }
                expect(typeGuard(wrongEventType)).toBe(false)

                // Test wrong message type
                const wrongMessageType = {
                    ...validEvent,
                    type: 'OtherEvent'
                }
                expect(typeGuard(wrongMessageType)).toBe(false)

                // Test missing getContent
                const missingGetContentInternal = {
                    ...validEvent,
                    getContent: undefined
                }
                expect(typeGuard(missingGetContentInternal)).toBe(false)
            })

            it('should call initializeSubscription when Initialize Subscription event is received', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                dataSource.subscribe()

                const initializeSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.assets.contentHeaders-initialize'
                )
                const callback = initializeSubscription[0].callback

                // Mock initializeSubscription method
                const mockInitializeSubscription = jest.spyOn(dataSource, 'initializeSubscription').mockResolvedValue(undefined)

                const testEvent = {
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.subscriptions',
                    streamKey: 'test-stream',
                    header: {
                        dataSourceKey: 'mtw.subscriptions',
                        streamKey: 'test-stream',
                        timestamp: 123456789,
                        type: 'Initialize Subscription - mtw.assets.contentHeaders'
                    },
                    getContent: () => Promise.resolve({ sessionId: 'SESSION#test-session', requestId: 'test-request-123' }),
                    timestamp: 123456789
                }

                await callback({ payloads: [testEvent], messageBus: mockMessageBus as any })

                expect(mockInitializeSubscription).toHaveBeenCalledWith({
                    sessionId: 'SESSION#test-session',
                    streamKey: 'test-stream'
                })
            })

            it('should handle multiple Initialize Subscription events in batch', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                dataSource.subscribe()

                const initializeSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.assets.contentHeaders-initialize'
                )
                const callback = initializeSubscription[0].callback

                // Mock initializeSubscription method
                const mockInitializeSubscription = jest.spyOn(dataSource, 'initializeSubscription').mockResolvedValue(undefined)

                const testEvents = [
                    {
                        type: 'StreamingEvent',
                        dataSourceKey: 'mtw.subscriptions',
                        streamKey: 'test-stream-1',
                        header: {
                            dataSourceKey: 'mtw.subscriptions',
                            streamKey: 'test-stream-1',
                            timestamp: 123456789,
                            type: 'Initialize Subscription - mtw.assets.contentHeaders'
                        },
                        getContent: () => Promise.resolve({ sessionId: 'SESSION#test-session-1', requestId: 'test-request-123' }),
                        timestamp: 123456789
                    },
                    {
                        type: 'StreamingEvent',
                        dataSourceKey: 'mtw.subscriptions',
                        streamKey: 'test-stream-2',
                        header: {
                            dataSourceKey: 'mtw.subscriptions',
                            streamKey: 'test-stream-2',
                            timestamp: 123456790,
                            type: 'Initialize Subscription - mtw.assets.contentHeaders'
                        },
                        getContent: () => Promise.resolve({ sessionId: 'SESSION#test-session-2', requestId: 'test-request-456' }),
                        timestamp: 123456790
                    }
                ]

                await callback({ payloads: testEvents, messageBus: mockMessageBus as any })

                expect(mockInitializeSubscription).toHaveBeenCalledTimes(2)
                expect(mockInitializeSubscription).toHaveBeenNthCalledWith(1, {
                    sessionId: 'SESSION#test-session-1',
                    streamKey: 'test-stream-1'
                })
                expect(mockInitializeSubscription).toHaveBeenNthCalledWith(2, {
                    sessionId: 'SESSION#test-session-2',
                    streamKey: 'test-stream-2'
                })
            })

            it('should handle errors in initializeSubscription gracefully', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                dataSource.subscribe()

                const initializeSubscription = mockMessageBus.subscribe.mock.calls.find(call => 
                    call[0].tag === 'dataSource-mtw.assets.contentHeaders-initialize'
                )
                const callback = initializeSubscription[0].callback

                // Mock initializeSubscription to throw an error
                const mockInitializeSubscription = jest.spyOn(dataSource, 'initializeSubscription').mockRejectedValue(new Error('Snapshot generation failed'))

                // Mock console.error to verify error logging
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

                const testEvent = {
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.subscriptions',
                    streamKey: 'test-stream',
                    header: {
                        dataSourceKey: 'mtw.subscriptions',
                        streamKey: 'test-stream',
                        timestamp: 123456789,
                        type: 'Initialize Subscription - mtw.assets.contentHeaders'
                    },
                    getContent: () => Promise.resolve({ sessionId: 'SESSION#test-session', requestId: 'test-request-123' }),
                    timestamp: 123456789
                }

                // Should not throw, but should log error
                await expect(callback({ payloads: [testEvent], messageBus: mockMessageBus as any })).resolves.not.toThrow()

                expect(mockInitializeSubscription).toHaveBeenCalledWith({
                    sessionId: 'SESSION#test-session',
                    streamKey: 'test-stream'
                })
                expect(consoleSpy).toHaveBeenCalledWith('Failed to process Initialize Subscription for streamKey: test-stream', expect.any(Error))

                consoleSpy.mockRestore()
            })
        })
    })

    describe('snapshot caching per streamKey', () => {
        it('should cache snapshots per streamKey when loading from store', async () => {
            const streamKey1 = 'stream-1'
            const streamKey2 = 'stream-2'
            
            // Mock different snapshot content for different streams
            const snapshot1 = {
                id: 'stream-1-id',
                name: 'Stream 1 Snapshot',
                value: 100,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            const snapshot2 = {
                id: 'stream-2-id', 
                name: 'Stream 2 Snapshot',
                value: 200,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            // Mock loadSnapshotFromStore to return different snapshots for different streams
            jest.spyOn(dataSource, 'loadSnapshotFromStore')
                .mockResolvedValueOnce(snapshot1) // First call for stream-1
                .mockResolvedValueOnce(snapshot2) // Second call for stream-2
            
            // Get snapshot for first stream
            const result1 = await dataSource.getSnapshot(streamKey1)
            expect(result1).toEqual({
                ...snapshot1,
                replayAt: 100000000
            })
            expect(dataSource._snapshots[streamKey1]).toEqual({
                ...snapshot1,
                replayAt: 100000000
            }) // Should be cached
            
            // Get snapshot for second stream - this should NOT return the cached snapshot from stream-1
            const result2 = await dataSource.getSnapshot(streamKey2)
            
            expect(result2).toEqual({
                ...snapshot2,
                replayAt: 100000000
            })
            expect(result2).not.toBe(snapshot1) // Should not be the cached snapshot from stream-1
            expect(dataSource._snapshots[streamKey2]).toEqual({
                ...snapshot2,
                replayAt: 100000000
            }) // Should be updated to stream-2's snapshot
            
            // Verify that loadSnapshotFromStore was called for both streams
            expect(dataSource.loadSnapshotFromStore).toHaveBeenCalledWith(streamKey1)
            expect(dataSource.loadSnapshotFromStore).toHaveBeenCalledWith(streamKey2)
        })

        it('should cache generated snapshots per streamKey when creating new snapshots', async () => {
            const streamKey1 = 'stream-1'
            const streamKey2 = 'stream-2'
            
            // Mock different snapshot content generation for different streams
            const generatedSnapshot1 = {
                type: 'Snapshot',
                id: 'generated-stream-1-id',
                name: 'Generated Stream 1 Snapshot',
                value: 300,
                createdAt: 100000000,
                replayAt: 100000000,
                expiresAt: 100300000
            }
            
            const generatedSnapshot2 = {
                type: 'Snapshot',
                id: 'generated-stream-2-id',
                name: 'Generated Stream 2 Snapshot', 
                value: 400,
                createdAt: 100000000,
                replayAt: 100000000,
                expiresAt: 100300000
            }
            
            // Mock snapshotContentGenerator to return different content for different streams
            mockSnapshotContentGenerator
                .mockResolvedValueOnce({
                    id: 'generated-stream-1-id',
                    name: 'Generated Stream 1 Snapshot',
                    value: 300
                })
                .mockResolvedValueOnce({
                    id: 'generated-stream-2-id',
                    name: 'Generated Stream 2 Snapshot',
                    value: 400
                })
            
            // Mock loadSnapshotFromStore to return undefined (no stored snapshots)
            jest.spyOn(dataSource, 'loadSnapshotFromStore')
                .mockResolvedValue(undefined)
            
            // Mock singleFlight to actually execute the computation function
            mockSingleFlight
                .mockImplementationOnce(async (params) => {
                    // Execute the computation function to call snapshotContentGenerator
                    return await params.computation()
                })
                .mockImplementationOnce(async (params) => {
                    // Execute the computation function to call snapshotContentGenerator
                    return await params.computation()
                })
            
            // Get snapshot for first stream (should generate new snapshot)
            const result1 = await dataSource.getSnapshot(streamKey1)
            expect(result1).toStrictEqual(generatedSnapshot1)
            expect(dataSource._snapshots[streamKey1]).toStrictEqual(generatedSnapshot1) // Should be cached
            
            // Get snapshot for second stream - this should NOT return the cached generated snapshot from stream-1
            const result2 = await dataSource.getSnapshot(streamKey2)
            
            // This test should now PASS because we fixed the implementation to cache per streamKey
            expect(result2).toStrictEqual(generatedSnapshot2)
            expect(result2).not.toStrictEqual(generatedSnapshot1) // Should not be the cached generated snapshot from stream-1
            expect(dataSource._snapshots[streamKey2]).toStrictEqual(generatedSnapshot2) // Should be updated to stream-2's generated snapshot
            
            // Verify that snapshotContentGenerator was called for both streams
            expect(mockSnapshotContentGenerator).toHaveBeenCalledWith(streamKey1)
            expect(mockSnapshotContentGenerator).toHaveBeenCalledWith(streamKey2)
            
            // Verify that singleFlight was called for both streams
            expect(mockSingleFlight).toHaveBeenCalledTimes(2)
        })
    })

    describe('replayable flag functionality', () => {
        describe('replayable: true (default)', () => {
            it('should initialize singleFlight when replayable is true', () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                expect(dataSource.replayable).toBe(true)
                expect(dataSource.singleFlight).toBeDefined()
                expect(mockSingleFlightFactory).toHaveBeenCalled()
            })

            it('should store events to DynamoDB when replayable is true', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                await dataSource.streamEvent({
                    update: { type: 'TestUpdatePayload', update: 'test-update' },
                    streamKey: 'test-stream',
                    header: { type: 'TestUpdatePayload' }
                })

                expect(mockDynamo.putItem).toHaveBeenCalledWith({
                    AssetId: 'STREAM#mtw.testDataSource::test-stream',
                    DataCategory: 'EVENT#100000000::test-uuid-123',
                    eventType: 'TestUpdatePayload',
                    update: {
                        type: 'TestUpdatePayload',
                        update: 'test-update'
                    }
                })
                expect(mockEventBridgeClient.send).toHaveBeenCalled()
                expect(mockMessageBus.publish).toHaveBeenCalled()
            })

            it('should allow initializeSubscription when replayable is true', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: true
                })

                mockSingleFlight.mockResolvedValue({
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42,
                    createdAt: 100000000,
                    expiresAt: 100300000
                })

                mockDynamo.query.mockResolvedValue([])

                await expect(dataSource.initializeSubscription({
                    sessionId: 'SESSION#test-session',
                    streamKey: 'test-stream'
                })).resolves.not.toThrow()

                expect(mockSns.send).toHaveBeenCalled()
            })
        })

        describe('replayable: false', () => {
            it('should not initialize singleFlight when replayable is false', () => {
                // Clear previous mock calls
                mockSingleFlightFactory.mockClear()
                
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                expect(dataSource.replayable).toBe(false)
                expect(dataSource.singleFlight).toBeUndefined()
                expect(mockSingleFlightFactory).not.toHaveBeenCalled()
            })

            it('should not store events to DynamoDB when replayable is false', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                await dataSource.streamEvent({
                    update: { type: 'TestUpdatePayload', update: 'test-update' },
                    streamKey: 'test-stream',
                    header: { type: 'TestUpdatePayload' }
                })

                expect(mockDynamo.putItem).not.toHaveBeenCalled()
                expect(mockEventBridgeClient.send).toHaveBeenCalled()
                expect(mockMessageBus.publish).toHaveBeenCalled()
            })

            it('should throw error for initializeSubscription when replayable is false', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                await expect(dataSource.initializeSubscription({
                    sessionId: 'SESSION#test-session',
                    streamKey: 'test-stream'
                })).rejects.toThrow("DataSource 'mtw.testDataSource' is not replayable and does not support subscription initialization")
            })

            it('should throw error when getSnapshot is called on non-replayable data source', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                await expect(dataSource.getSnapshot('test-stream')).rejects.toThrow(
                    "DataSource 'mtw.testDataSource' is not replayable and does not support snapshots"
                )
                expect(mockSnapshotContentGenerator).not.toHaveBeenCalled()
                expect(mockSingleFlight).not.toHaveBeenCalled()
                expect(mockDynamo.getItem).not.toHaveBeenCalled()
            })

            it('should return empty array for getRecentEvents when replayable is false', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                const events = await dataSource.getRecentEvents('test-stream', 100000000)

                expect(events).toEqual([])
                expect(mockDynamo.query).not.toHaveBeenCalled()
            })

            it('should return undefined for loadSnapshotFromStore when replayable is false', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                const snapshot = await dataSource.loadSnapshotFromStore('test-stream')

                expect(snapshot).toBeUndefined()
                expect(mockDynamo.getItem).not.toHaveBeenCalled()
            })

            it('should do nothing for storeSnapshotToStore when replayable is false', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                await dataSource.storeSnapshotToStore({
                    streamKey: 'test-stream',
                    snapshot: {
                        id: 'test-id',
                        name: 'Test Snapshot',
                        value: 42,
                        createdAt: 100000000,
                        expiresAt: 100300000
                    }
                })

                expect(mockDynamo.putItem).not.toHaveBeenCalled()
            })

            it('should throw error when getSnapshot is called without snapshotContentGenerator on non-replayable data source', async () => {
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    // No snapshotContentGenerator provided
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                    replayable: false
                })

                await expect(dataSource.getSnapshot('test-stream')).rejects.toThrow(
                    "DataSource 'mtw.testDataSource' is not replayable and does not support snapshots"
                )
                expect(mockSnapshotContentGenerator).not.toHaveBeenCalled()
                expect(mockSingleFlight).not.toHaveBeenCalled()
                expect(mockDynamo.getItem).not.toHaveBeenCalled()
            })
        })

        describe('default behavior', () => {
            it('should default to replayable: true when not specified', () => {
                // Clear previous mock calls
                mockSingleFlightFactory.mockClear()
                
                const dataSource = new TestDataSource({
                    dynamo: mockDynamo,
                    sns: mockSns,
                    messageBus: mockMessageBus,
                    primaryKeyName: 'AssetId',
                    dataSourceKey: 'mtw.testDataSource',
                    snapshotContentGenerator: mockSnapshotContentGenerator,
                    feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
                })

                expect(dataSource.replayable).toBe(true)
                expect(dataSource.singleFlight).toBeDefined()
                expect(mockSingleFlightFactory).toHaveBeenCalled()
            })
        })
    })

    describe('publisher strategy functionality', () => {
        it('should default to eventBridge+bus when strategy is not provided', () => {
            const strategyDefaultDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })

            expect(strategyDefaultDataSource.publisherStrategy).toBe('eventBridge+bus')
        })

        it('should publish to EventBridge and messageBus by default in streamEvent', async () => {
            const strategyDefaultDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })

            await strategyDefaultDataSource.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                streamKey: 'test-stream',
                header: { type: 'TestUpdatePayload' }
            })

            expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(1)
            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        })

        it('should skip EventBridge and still publish to messageBus in streamEvent for busOnly strategy', async () => {
            const busOnlyDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                publisherStrategy: 'busOnly'
            })

            await busOnlyDataSource.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                streamKey: 'test-stream',
                header: { type: 'TestUpdatePayload' }
            })

            expect(mockEventBridgeClient.send).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        })

        it('should skip EventBridge and still publish to messageBus in streamEnvelope for busOnly strategy', async () => {
            const busOnlyDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                publisherStrategy: 'busOnly'
            })
            const coreFormat = {
                header: {
                    dataSourceKey: 'mtw.testDataSource' as const,
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload' as const,
                },
                update: { type: 'TestUpdatePayload', update: 'test-update' },
            }
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () => Promise.resolve({ type: 'TestUpdatePayload', update: 'test-update' }))

            await busOnlyDataSource.streamEnvelope(envelope)

            expect(mockEventBridgeClient.send).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        })

        it('should keep replayable Dynamo writes when strategy is busOnly', async () => {
            const replayableBusOnlyDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                replayable: true,
                publisherStrategy: 'busOnly'
            })

            await replayableBusOnlyDataSource.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                streamKey: 'test-stream',
                header: { type: 'TestUpdatePayload' }
            })

            expect(mockDynamo.putItem).toHaveBeenCalledTimes(1)
            expect(mockEventBridgeClient.send).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        })

        it('should not write Dynamo and should still publish to messageBus when non-replayable + busOnly', async () => {
            const nonReplayableBusOnlyDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                replayable: false,
                publisherStrategy: 'busOnly'
            })

            await nonReplayableBusOnlyDataSource.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                streamKey: 'test-stream',
                header: { type: 'TestUpdatePayload' }
            })

            expect(mockDynamo.putItem).not.toHaveBeenCalled()
            expect(mockEventBridgeClient.send).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        })
    })

    describe('messageBus publish outbounds', () => {
        it('should publish to messageBus via publish for streamEvent', async () => {
            await dataSource.streamEvent({
                streamKey: 'test-stream',
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                header: { type: 'TestUpdatePayload' },
            })

            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'StreamingEvent',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                header: {
                    dataSourceKey: 'mtw.testDataSource',
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload',
                },
                getContent: expect.any(Function),
                timestamp: 100000000,
            })

            const publishCall = mockMessageBus.publish.mock.calls[0][0]
            const content = await publishCall.getContent()
            expect(content).toEqual({
                type: 'TestUpdatePayload',
                update: 'test-update',
            })
        })

        it('should publish to messageBus via publish for streamEnvelope', async () => {
            const coreFormat = {
                header: {
                    dataSourceKey: 'mtw.testDataSource' as const,
                    streamKey: 'test-stream',
                    timestamp: 100000000,
                    type: 'TestUpdatePayload' as const,
                },
                update: { type: 'TestUpdatePayload', update: 'test-update' },
            }
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () => Promise.resolve({ type: 'TestUpdatePayload', update: 'test-update' }))

            await dataSource.streamEnvelope(envelope)

            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
            const messageBusPayload = mockMessageBus.publish.mock.calls[0][0]
            expect(messageBusPayload.getContent).toBe(envelope.getContent)
        })

        it('should skip EventBridge and use publish for busOnly in streamEvent', async () => {
            const busOnlyDataSource = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                publisherStrategy: 'busOnly',
            })

            await busOnlyDataSource.streamEvent({
                update: { type: 'TestUpdatePayload', update: 'test-update' },
                streamKey: 'test-stream',
                header: { type: 'TestUpdatePayload' },
            })

            expect(mockEventBridgeClient.send).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
        })
    })

    describe('Snapshot Serialization', () => {
        type ExternalTestSnapshotPayload = {
            externalId: string
            externalName: string
            externalValue: number
        }

        type ExternalTestUpdatePayload = {
            type: 'ExternalTestUpdate'
            externalUpdate: string
        }

        let mockSerializer: any
        let dataSourceWithSerializer: TestDataSource<TestSnapshotPayload, TestUpdatePayload, ExternalTestUpdatePayload, 'AssetId', ExternalTestSnapshotPayload>

        beforeEach(() => {
            mockSerializer = {
                serialize: jest.fn((params: { content: any; header: { type: string } }) => {
                    if (params.header?.type === 'Snapshot') {
                        const snapshot = params.content as SnapshotType<TestSnapshotPayload>
                        return { externalId: snapshot.id, externalName: snapshot.name, externalValue: snapshot.value }
                    }
                    return params.content
                }),
                deserialize: jest.fn(async (params: { content: any; header: { type: string } }) => {
                    if (params.header?.type === 'Snapshot') {
                        const external = params.content as ExternalTestSnapshotPayload
                        return { id: external.externalId, name: external.externalName, value: external.externalValue }
                    }
                    return params.content
                })
            }

            dataSourceWithSerializer = new TestDataSource({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback',
                eventSerializer: mockSerializer
            })
        })

        describe('getSnapshotExternal', () => {
            it('should return snapshot in external format', async () => {
                const streamKey = 'test-stream'
                const internalSnapshot = {
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42,
                    createdAt: 100000000,
                    replayAt: 100000000,
                    expiresAt: 100300000
                }

                mockSnapshotContentGenerator.mockResolvedValue({
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42
                })

                jest.spyOn(dataSourceWithSerializer, 'loadSnapshotFromStore').mockResolvedValue(undefined)
                
                // Mock singleFlight to execute the computation function
                const mockSingleFlightExecutor = jest.fn(async ({ computation }) => {
                    return await computation()
                })
                jest.spyOn(dataSourceWithSerializer, 'singleFlight' as any).mockImplementation(mockSingleFlightExecutor)

                const result = await dataSourceWithSerializer.getSnapshotExternal(streamKey)

                expect(mockSerializer.serialize).toHaveBeenCalledWith({
                    content: internalSnapshot,
                    header: expect.objectContaining({ dataSourceKey: 'mtw.testDataSource', streamKey, timestamp: 100000000, type: 'Snapshot' })
                })
                expect(result).toEqual({
                    type: 'Snapshot',
                    externalId: 'test-id',
                    externalName: 'Test Snapshot',
                    externalValue: 42,
                    createdAt: 100000000,
                    replayAt: 100000000,
                    expiresAt: 100300000
                })
            })

            it('should return cached external snapshot from storage', async () => {
                const streamKey = 'test-stream'
                const externalSnapshot = {
                    type: 'Snapshot',
                    externalId: 'stored-id',
                    externalName: 'Stored Snapshot',
                    externalValue: 200,
                    createdAt: 100000000,
                    replayAt: 100002000,
                    expiresAt: 100300000
                }

                jest.spyOn(dataSourceWithSerializer, 'loadSnapshotFromStore').mockResolvedValue(externalSnapshot)

                const result = await dataSourceWithSerializer.getSnapshotExternal(streamKey)

                expect(result).toBe(externalSnapshot)
                expect(mockSerializer.serialize).not.toHaveBeenCalled()
            })
        })

        describe('getSnapshot', () => {
            it('should deserialize external snapshot to internal format', async () => {
                const streamKey = 'test-stream'
                const externalSnapshot = {
                    type: 'Snapshot' as const,
                    externalId: 'test-id',
                    externalName: 'Test Snapshot',
                    externalValue: 42,
                    createdAt: 100000000,
                    replayAt: 100002000,
                    expiresAt: 100300000
                }

                jest.spyOn(dataSourceWithSerializer, 'getSnapshotExternal').mockResolvedValue(externalSnapshot)

                const result = await dataSourceWithSerializer.getSnapshot(streamKey)

                expect(mockSerializer.deserialize).toHaveBeenCalledWith({
                    content: { type: 'Snapshot', externalId: 'test-id', externalName: 'Test Snapshot', externalValue: 42 },
                    header: expect.objectContaining({ dataSourceKey: 'mtw.testDataSource', streamKey, timestamp: 100000000, type: 'Snapshot' })
                })
                expect(result).toEqual({
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42,
                    createdAt: 100000000,
                    replayAt: 100002000,
                    expiresAt: 100300000
                })
            })

            it('should return cached internal snapshot', async () => {
                const streamKey = 'test-stream'
                const cachedSnapshot = {
                    id: 'cached-id',
                    name: 'Cached Snapshot',
                    value: 100,
                    createdAt: 100000000,
                    replayAt: 100002000,
                    expiresAt: 100300000
                }

                dataSourceWithSerializer._snapshots[streamKey] = cachedSnapshot

                const result = await dataSourceWithSerializer.getSnapshot(streamKey)

                expect(result).toBe(cachedSnapshot)
                expect(mockSerializer.deserialize).not.toHaveBeenCalled()
            })
        })

        describe('storeSnapshotToStore', () => {
            it('should serialize snapshot before storing', async () => {
                const streamKey = 'test-stream'
                const internalSnapshot = {
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42,
                    createdAt: 100000000,
                    replayAt: 100002000,
                    expiresAt: 100300000
                }

                await dataSourceWithSerializer.storeSnapshotToStore({ streamKey, snapshot: internalSnapshot })

                expect(mockSerializer.serialize).toHaveBeenCalledWith({
                    content: internalSnapshot,
                    header: expect.objectContaining({ dataSourceKey: 'mtw.testDataSource', streamKey, timestamp: 100000000, type: 'Snapshot' })
                })
                expect(mockDynamo.putItem).toHaveBeenCalledWith({
                    AssetId: 'STREAM#mtw.testDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot',
                    snapshotHeader: {
                        dataSourceKey: 'mtw.testDataSource',
                        streamKey: 'test-stream',
                        timestamp: 100000000,
                        replayAt: 100002000,
                        type: 'Snapshot'
                    },
                    snapshotUpdate: {
                        externalId: 'test-id',
                        externalName: 'Test Snapshot',
                        externalValue: 42
                    }
                })
            })
        })

        describe('initializeSubscription', () => {
            it('should use external snapshot format for delivery', async () => {
                const sessionId = 'SESSION#test-session' as const
                const streamKey = 'test-stream'
                const externalSnapshot = {
                    type: 'Snapshot',
                    externalId: 'test-id',
                    externalName: 'Test Snapshot',
                    externalValue: 42,
                    createdAt: 100000000,
                    expiresAt: 100300000
                }

                jest.spyOn(dataSourceWithSerializer, 'getSnapshotExternal').mockResolvedValue(externalSnapshot)
                mockDynamo.query.mockResolvedValue([])

                await dataSourceWithSerializer.initializeSubscription({ sessionId, streamKey })

                // Snapshot is delivered in SNS Feedback format (flat structure)
                const snapshotCall = mockSns.send.mock.calls[0][0]
                const snapshotMessage = JSON.parse(snapshotCall.Message)
                expect(snapshotMessage).toMatchObject({
                    messageType: 'StreamEvent',
                    dataSourceKey: 'mtw.testDataSource',
                    streamKey: 'test-stream',
                    update: expect.objectContaining({
                        type: 'Snapshot',
                        externalId: 'test-id'
                    })
                })
            })
        })
    })
})
