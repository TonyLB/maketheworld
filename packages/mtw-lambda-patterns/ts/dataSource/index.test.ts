import { DataSource, SerializableObject, SnapshotType } from './index'
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

const mockSingleFlightFactory = singleFlightFactory as jest.MockedFunction<typeof singleFlightFactory>
const mockEventBridgeClient = eventBridgeClient as jest.Mocked<typeof eventBridgeClient>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>
const mockPublishCommand = PublishCommand as jest.MockedClass<typeof PublishCommand>

type TestSnapshotPayload = {
    id: string
    name: string
    value: number
}

type TestUpdatePayload = string

// Test subclass to expose protected methods
class TestDataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject, ExternalUpdatePayload extends string | SerializableObject = string | SerializableObject, KeyType extends string = string> extends DataSource<SnapshotPayload, UpdatePayload, never, ExternalUpdatePayload, KeyType> {
    public override async loadSnapshotFromStore(streamKey: string): Promise<SnapshotType<SnapshotPayload> | undefined> {
        return super.loadSnapshotFromStore(streamKey)
    }
    
    public override async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        return super.storeSnapshotToStore({ streamKey, snapshot })
    }

    public override async getRecentEvents(streamKey: string, sinceTimestamp: number): Promise<Array<{ update: ExternalUpdatePayload, timestamp: number, streamKey: string }>> {
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
            send: jest.fn(),
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
                optimisticUpdateFunction: mockDynamo.optimisticUpdate,
                getItemFunction: mockDynamo.getItem,
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
            
            expect(result).toBe(storedSnapshot)
            expect(dataSource._snapshots[streamKey]).toBe(storedSnapshot)
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
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
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
            const snapshot = {
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
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100300000
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
            const snapshot = {
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
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100300000
            })
        })

        it('should spread all snapshot properties into the stored record', async () => {
            const streamKey = 'test-stream'
            const snapshot = {
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100300000,
                customField: 'custom value',
                nestedObject: { key: 'value' }
            }
            
            await dataSource.storeSnapshotToStore({ streamKey, snapshot })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'Meta::Snapshot',
                id: 'test-id',
                name: 'Test Snapshot',
                value: 42,
                createdAt: 100000000,
                expiresAt: 100300000,
                customField: 'custom value',
                nestedObject: { key: 'value' }
            })
        })
    })

    describe('loadSnapshotFromStore', () => {
        it('should load snapshot with correct primary key and DataCategory', async () => {
            const streamKey = 'test-stream'
            const storedSnapshot = {
                id: 'stored-id',
                name: 'Stored Snapshot',
                value: 200,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            mockDynamo.getItem.mockResolvedValue(storedSnapshot)
            
            const result = await dataSource.loadSnapshotFromStore(streamKey)
            
            expect(mockDynamo.getItem).toHaveBeenCalledWith({
                Key: {
                    AssetId: 'STREAM#mtw.testDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot'
                }
            })
            expect(result).toBe(storedSnapshot)
        })

        it('should return undefined when no snapshot is found', async () => {
            const streamKey = 'test-stream'
            
            mockDynamo.getItem.mockResolvedValue(undefined)
            
            const result = await dataSource.loadSnapshotFromStore(streamKey)
            
            expect(mockDynamo.getItem).toHaveBeenCalledWith({
                Key: {
                    AssetId: 'STREAM#mtw.testDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot'
                }
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
                value: 200,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            mockDynamo.getItem.mockResolvedValue(storedSnapshot)
            
            const result = await dataSourceWithDifferentKey.loadSnapshotFromStore(streamKey)
            
            expect(mockDynamo.getItem).toHaveBeenCalledWith({
                Key: {
                    EphemeraId: 'STREAM#mtw.differentDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot'
                }
            })
            expect(result).toBe(storedSnapshot)
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
            mockUuidv4.mockReturnValue('test-uuid-123')
        })

        afterEach(() => {
            jest.clearAllMocks()
        })

        it('should store event to DynamoDB and publish to EventBridge in parallel', async () => {
            const streamKey = 'test-stream'
            const update = 'test-update'
            const detailType = 'Test Stream Event'
            
            await dataSource.streamEvent({ update, streamKey, detailType })
            
            // Verify DynamoDB putItem was called with correct event record
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::test-uuid-123',
                update: 'test-update',
                streamKey: 'test-stream'
            })
            
            // Verify EventBridge send was called with correct event
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.testDataSource',
                DetailType: 'Test Stream Event',
                Detail: {
                    streamKey: 'test-stream',
                    update: 'test-update',
                }
            }])
        })

        it('should handle object update payloads correctly', async () => {
            const streamKey = 'test-stream'
            const update = 'test-update' // Using string since TestUpdatePayload is string
            const detailType = 'Test Stream Event'
            
            await dataSource.streamEvent({ update, streamKey, detailType })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::test-uuid-123',
                update: 'test-update',
                streamKey: 'test-stream'
            })
            
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.testDataSource',
                DetailType: 'Test Stream Event',
                Detail: {
                    streamKey: 'test-stream',
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
            
            const streamKey = 'test-stream'
            const update = 'test-update'
            const detailType = 'Different Stream Event'
            
            await dataSourceWithDifferentKey.streamEvent({ update, streamKey, detailType })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                EphemeraId: 'STREAM#mtw.differentDataSource::test-stream',
                DataCategory: 'EVENT#100000000::test-uuid-123',
                update: 'test-update',
                streamKey: 'test-stream'
            })
            
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.differentDataSource',
                DetailType: 'Different Stream Event',
                Detail: {
                    streamKey: 'test-stream',
                    update: 'test-update',
                }
            }])
        })

        it('should handle parallel execution failures gracefully', async () => {
            const streamKey = 'test-stream'
            const update = 'test-update'
            const detailType = 'Test Stream Event'
            
            // Make DynamoDB operation fail
            mockDynamo.putItem.mockRejectedValueOnce(new Error('DynamoDB error'))
            
            await expect(dataSource.streamEvent({ update, streamKey, detailType })).rejects.toThrow('DynamoDB error')
            
            // Verify EventBridge was still called (parallel execution)
            expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(1)
        })

        it('should handle EventBridge failures gracefully', async () => {
            const streamKey = 'test-stream'
            const update = 'test-update'
            const detailType = 'Test Stream Event'
            
            // Make EventBridge operation fail
            mockEventBridgeClient.send.mockRejectedValueOnce(new Error('EventBridge error'))
            
            await expect(dataSource.streamEvent({ update, streamKey, detailType })).rejects.toThrow('EventBridge error')
            
            // Verify DynamoDB was still called (parallel execution)
            expect(mockDynamo.putItem).toHaveBeenCalledTimes(1)
        })

        it('should generate unique event IDs for different calls', async () => {
            const streamKey = 'test-stream'
            const update = 'test-update'
            const detailType = 'Test Stream Event'
            
            // Mock different UUIDs for different calls
            mockUuidv4
                .mockReturnValueOnce('uuid-1')
                .mockReturnValueOnce('uuid-2')
            
            await dataSource.streamEvent({ update, streamKey, detailType })
            await dataSource.streamEvent({ update, streamKey, detailType })
            
            expect(mockDynamo.putItem).toHaveBeenNthCalledWith(1, {
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::uuid-1',
                update: 'test-update',
                streamKey: 'test-stream'
            })
            
            expect(mockDynamo.putItem).toHaveBeenNthCalledWith(2, {
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#100000000::uuid-2',
                update: 'test-update',
                streamKey: 'test-stream'
            })
        })

        it('should use current timestamp from getCurrentTimestamp', async () => {
            const streamKey = 'test-stream'
            const update = 'test-update'
            const detailType = 'Test Stream Event'
            
            // Mock different timestamp
            mockGetCurrentTimestamp.mockReturnValueOnce(200000000)
            
            await dataSource.streamEvent({ update, streamKey, detailType })
            
            expect(mockDynamo.putItem).toHaveBeenCalledWith({
                AssetId: 'STREAM#mtw.testDataSource::test-stream',
                DataCategory: 'EVENT#200000000::test-uuid-123',
                update: 'test-update',
                streamKey: 'test-stream'
            })
            
            expect(mockEventBridgeClient.send).toHaveBeenCalledWith([{
                Source: 'mtw.testDataSource',
                DetailType: 'Test Stream Event',
                Detail: {
                    streamKey: 'test-stream',
                    update: 'test-update',
                }
            }])
        })

        it('should publish to messageBus for internal event coordination', async () => {
            const streamKey = 'test-stream'
            const update = 'test-update'
            const detailType = 'Test Stream Event'
            
            await dataSource.streamEvent({ update, streamKey, detailType })
            
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                messageType: 'StreamingEvent',
                dataSourceKey: 'mtw.testDataSource',
                detailType: 'Test Stream Event',
                event: {
                    streamKey: 'test-stream',
                    update: 'test-update',
                },
                timestamp: 100000000
            })
        })
    })

    describe('initializeSubscription', () => {
        it('should deliver snapshot and events via SNS', async () => {
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
            
            // Mock the getSnapshot method by setting up the cache
            dataSource._snapshots[streamKey] = mockSnapshot
            
            // Mock DynamoDB query to return raw events (with DataCategory)
            const mockEvents = [
                { update: 'test-update-1', DataCategory: 'EVENT#100001000::event-1', streamKey: 'test-stream' },
                { update: 'test-update-2', DataCategory: 'EVENT#100002000::event-2', streamKey: 'test-stream' }
            ]
            
            // Mock the query method to return events
            mockDynamo.query.mockResolvedValue(mockEvents)
            
            await dataSource.initializeSubscription({ sessionId, streamKey })
            
            // Verify SNS was called twice (snapshot + events)
            expect(mockSns.send).toHaveBeenCalledTimes(2)
            
            // Verify snapshot message
            const snapshotCall = mockSns.send.mock.calls[0][0]
            expect(snapshotCall.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-feedback')
            const snapshotMessage = JSON.parse(snapshotCall.Message)
            expect(snapshotMessage).toMatchObject({
                messageType: 'DataSourceSnapshot',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                snapshot: {
                    id: 'test-id',
                    name: 'Test Snapshot',
                    value: 42
                }
            })
            expect(snapshotCall.MessageAttributes.Targets.StringValue).toBe(JSON.stringify([sessionId]))
            
            // Verify events message
            const eventsCall = mockSns.send.mock.calls[1][0]
            expect(eventsCall.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-feedback')
            expect(JSON.parse(eventsCall.Message)).toMatchObject({
                messageType: 'DataSourceEvents',
                dataSourceKey: 'mtw.testDataSource',
                streamKey: 'test-stream',
                events: [
                    { update: 'test-update-1', timestamp: 100001000 },
                    { update: 'test-update-2', timestamp: 100002000 }
                ]
            })
            expect(eventsCall.MessageAttributes.Targets.StringValue).toBe(JSON.stringify([sessionId]))
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
            
            // Should only call SNS once (snapshot only, no events message)
            expect(mockSns.send).toHaveBeenCalledTimes(1)
            
            const snapshotCall = mockSns.send.mock.calls[0][0]
            expect(JSON.parse(snapshotCall.Message).messageType).toBe('DataSourceSnapshot')
        })
    })

    describe('type safety', () => {
        it('should work with different SerializableObject types', () => {
            type ComplexSnapshot = {
                id: string
                metadata: {
                    version: number
                    tags: string[]
                }
                data: Record<string, unknown>
            }
            
            const complexDataSource = new TestDataSource<ComplexSnapshot, string>({
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

        it('should work with string UpdatePayload', () => {
            const stringUpdateDataSource = new TestDataSource<TestSnapshotPayload, string>({
                dynamo: mockDynamo,
                sns: mockSns,
                messageBus: mockMessageBus,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'mtw.stringUpdateDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator,
                feedbackTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-feedback'
            })
            
            expect(stringUpdateDataSource).toBeDefined()
        })

        it('should work with object UpdatePayload', () => {
            type ObjectUpdate = {
                type: string
                payload: unknown
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

            // Mock type guard
            mockSubscribedEventTypeGuard = jest.fn().mockReturnValue(true)

            // Reset mocks
            jest.clearAllMocks()
        })

        describe('subscribe', () => {
            it('should not subscribe if subscribedEventTypeGuard is not provided', () => {
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

                expect(mockMessageBus.subscribe).not.toHaveBeenCalled()
            })

            it('should not subscribe if receiveEvents is not provided', () => {
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

                expect(mockMessageBus.subscribe).not.toHaveBeenCalled()
            })

            it('should subscribe to messageBus with correct configuration', () => {
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

                expect(mockMessageBus.subscribe).toHaveBeenCalledWith({
                    tag: 'dataSource-mtw.testDataSource',
                    priority: 5,
                    filter: expect.any(Function),
                    callback: expect.any(Function)
                })
            })

            it('should create correct type guard that filters by messageType and uses subscribedEventTypeGuard', () => {
                // Mock the type guard to simulate real-world usage:
                // 1. Check dataSourceKey to identify the publishing source
                // 2. Apply specific filtering based on event content from that source
                mockSubscribedEventTypeGuard.mockImplementation((event) => {
                    // First check: is this from a data source we care about?
                    if (event.dataSourceKey === 'mtw.assets') {
                        // Second check: is this a specific type of asset event we want?
                        return event.detailType === 'AssetUpdated' && event.event.assetId?.startsWith('char-')
                    }
                    if (event.dataSourceKey === 'mtw.ephemera') {
                        // Different filtering logic for ephemera events
                        return event.detailType === 'StateChanged' && event.event.zoneId === 'zone-123'
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

                const subscription = mockMessageBus.subscribe.mock.calls[0][0]
                const typeGuard = subscription.filter

                // Test with valid asset event that matches our filtering criteria
                const validAssetEvent = {
                    messageType: 'StreamingEvent',
                    dataSourceKey: 'mtw.assets',
                    detailType: 'AssetUpdated',
                    event: { assetId: 'char-123', name: 'Test Character' },
                    timestamp: 123456789
                }
                expect(typeGuard(validAssetEvent)).toBe(true)
                expect(mockSubscribedEventTypeGuard).toHaveBeenCalledWith({
                    dataSourceKey: 'mtw.assets',
                    detailType: 'AssetUpdated',
                    event: { assetId: 'char-123', name: 'Test Character' },
                    timestamp: 123456789
                })

                // Reset mock for next test
                mockSubscribedEventTypeGuard.mockClear()

                // Test with valid ephemera event that matches our filtering criteria
                const validEphemeraEvent = {
                    messageType: 'StreamingEvent',
                    dataSourceKey: 'mtw.ephemera',
                    detailType: 'StateChanged',
                    event: { zoneId: 'zone-123', state: 'active' },
                    timestamp: 123456790
                }
                expect(typeGuard(validEphemeraEvent)).toBe(true)
                expect(mockSubscribedEventTypeGuard).toHaveBeenCalledWith({
                    dataSourceKey: 'mtw.ephemera',
                    detailType: 'StateChanged',
                    event: { zoneId: 'zone-123', state: 'active' },
                    timestamp: 123456790
                })

                // Reset mock for next test
                mockSubscribedEventTypeGuard.mockClear()

                // Test with wrong messageType
                const wrongMessageType = {
                    messageType: 'OtherEvent',
                    dataSourceKey: 'mtw.assets',
                    event: { assetId: 'char-123' },
                    timestamp: 123456789
                }
                expect(typeGuard(wrongMessageType)).toBe(false)
                expect(mockSubscribedEventTypeGuard).not.toHaveBeenCalled()

                // Test with asset event that doesn't match our criteria (wrong asset type)
                const wrongAssetType = {
                    messageType: 'StreamingEvent',
                    dataSourceKey: 'mtw.assets',
                    detailType: 'AssetUpdated',
                    event: { assetId: 'item-456' }, // Not a character
                    timestamp: 123456789
                }
                expect(typeGuard(wrongAssetType)).toBe(false)
                expect(mockSubscribedEventTypeGuard).toHaveBeenCalledWith({
                    dataSourceKey: 'mtw.assets',
                    detailType: 'AssetUpdated',
                    event: { assetId: 'item-456' },
                    timestamp: 123456789
                })

                // Reset mock for next test
                mockSubscribedEventTypeGuard.mockClear()

                // Test with ephemera event that doesn't match our criteria (wrong zone)
                const wrongZone = {
                    messageType: 'StreamingEvent',
                    dataSourceKey: 'mtw.ephemera',
                    detailType: 'StateChanged',
                    event: { zoneId: 'zone-456' }, // Wrong zone
                    timestamp: 123456789
                }
                expect(typeGuard(wrongZone)).toBe(false)
                expect(mockSubscribedEventTypeGuard).toHaveBeenCalledWith({
                    dataSourceKey: 'mtw.ephemera',
                    detailType: 'StateChanged',
                    event: { zoneId: 'zone-456' },
                    timestamp: 123456789
                })
            })

            it('should call receiveEvents for each filtered event', async () => {
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

                const subscription = mockMessageBus.subscribe.mock.calls[0][0]
                const callback = subscription.callback

                // Mock streamEvent method
                const mockStreamEvent = jest.spyOn(dataSource, 'streamEvent').mockResolvedValue(undefined)

                // Test callback with multiple events from other data sources
                const testEvents = [
                    {
                        messageType: 'StreamingEvent',
                        dataSourceKey: 'mtw.otherDataSource',
                        detailType: 'event1',
                        event: { type: 'event1', data: 'test1' },
                        timestamp: 123456789
                    },
                    {
                        messageType: 'StreamingEvent',
                        dataSourceKey: 'mtw.anotherDataSource',
                        detailType: 'event2',
                        event: { type: 'event2', data: 'test2' },
                        timestamp: 123456790
                    }
                ]

                await callback({ payloads: testEvents })

                expect(mockReceiveEvents).toHaveBeenCalledTimes(2)
                expect(mockReceiveEvents).toHaveBeenNthCalledWith(1, {
                    event: {
                        messageType: 'StreamingEvent',
                        dataSourceKey: 'mtw.otherDataSource',
                        detailType: 'event1',
                        event: { type: 'event1', data: 'test1' },
                        timestamp: 123456789
                    },
                    streamEvent: expect.any(Function)
                })
                expect(mockReceiveEvents).toHaveBeenNthCalledWith(2, {
                    event: {
                        messageType: 'StreamingEvent',
                        dataSourceKey: 'mtw.anotherDataSource',
                        detailType: 'event2',
                        event: { type: 'event2', data: 'test2' },
                        timestamp: 123456790
                    },
                    streamEvent: expect.any(Function)
                })

                // Test that streamEvent function works
                const streamEventFunction = mockReceiveEvents.mock.calls[0][0].streamEvent
                await streamEventFunction({
                    update: 'test-update',
                    streamKey: 'test-stream',
                    detailType: 'Test Event'
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: 'test-update',
                    streamKey: 'test-stream',
                    detailType: 'Test Event'
                })
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

                const subscription = mockMessageBus.subscribe.mock.calls[0][0]
                const callback = subscription.callback

                const testEvents = [
                    {
                        messageType: 'StreamingEvent',
                        dataSourceKey: 'mtw.otherDataSource',
                        detailType: 'event1',
                        event: { type: 'event1' },
                        timestamp: 123456789
                    }
                ]

                // Promise.all will reject if any promise rejects
                await expect(callback({ payloads: testEvents })).rejects.toThrow('Processing failed')
                expect(errorReceiveEvents).toHaveBeenCalled()
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
            expect(result1).toBe(snapshot1)
            expect(dataSource._snapshots[streamKey1]).toBe(snapshot1) // Should be cached
            
            // Get snapshot for second stream - this should NOT return the cached snapshot from stream-1
            const result2 = await dataSource.getSnapshot(streamKey2)
            
            expect(result2).toBe(snapshot2)
            expect(result2).not.toBe(snapshot1) // Should not be the cached snapshot from stream-1
            expect(dataSource._snapshots[streamKey2]).toBe(snapshot2) // Should be updated to stream-2's snapshot
            
            // Verify that loadSnapshotFromStore was called for both streams
            expect(dataSource.loadSnapshotFromStore).toHaveBeenCalledWith(streamKey1)
            expect(dataSource.loadSnapshotFromStore).toHaveBeenCalledWith(streamKey2)
        })

        it('should cache generated snapshots per streamKey when creating new snapshots', async () => {
            const streamKey1 = 'stream-1'
            const streamKey2 = 'stream-2'
            
            // Mock different snapshot content generation for different streams
            const generatedSnapshot1 = {
                id: 'generated-stream-1-id',
                name: 'Generated Stream 1 Snapshot',
                value: 300,
                createdAt: 100000000,
                expiresAt: 100300000
            }
            
            const generatedSnapshot2 = {
                id: 'generated-stream-2-id',
                name: 'Generated Stream 2 Snapshot', 
                value: 400,
                createdAt: 100000000,
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
                    update: 'test-update',
                    streamKey: 'test-stream',
                    detailType: 'Test Event'
                })

                expect(mockDynamo.putItem).toHaveBeenCalledWith({
                    AssetId: 'STREAM#mtw.testDataSource::test-stream',
                    DataCategory: 'EVENT#100000000::test-uuid-123',
                    update: 'test-update',
                    streamKey: 'test-stream'
                })
                expect(mockEventBridgeClient.send).toHaveBeenCalled()
                expect(mockMessageBus.send).toHaveBeenCalled()
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
                    update: 'test-update',
                    streamKey: 'test-stream',
                    detailType: 'Test Event'
                })

                expect(mockDynamo.putItem).not.toHaveBeenCalled()
                expect(mockEventBridgeClient.send).toHaveBeenCalled()
                expect(mockMessageBus.send).toHaveBeenCalled()
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

            it('should generate snapshot without storage when replayable is false', async () => {
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

                const snapshot = await dataSource.getSnapshot('test-stream')

                expect(snapshot).toEqual({
                    streamKey: 'test-stream',
                    timestamp: 100000000
                })
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

            it('should work without snapshotContentGenerator when replayable is false', async () => {
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

                const snapshot = await dataSource.getSnapshot('test-stream')

                expect(snapshot).toEqual({
                    streamKey: 'test-stream',
                    timestamp: 100000000
                })
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
})
