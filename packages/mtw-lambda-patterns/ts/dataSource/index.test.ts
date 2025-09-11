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

// Import the mocked singleFlightFactory after mocking
import { singleFlightFactory } from '../singleFlight'
const mockSingleFlightFactory = singleFlightFactory as jest.MockedFunction<typeof singleFlightFactory>

type TestSnapshotPayload = {
    id: string
    name: string
    value: number
}

type TestUpdatePayload = string

// Test subclass to expose protected methods
class TestDataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject> extends DataSource<SnapshotPayload, UpdatePayload> {
    public override async loadSnapshotFromStore(streamKey: string): Promise<SnapshotType<SnapshotPayload> | undefined> {
        return super.loadSnapshotFromStore(streamKey)
    }
    
    public override async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        return super.storeSnapshotToStore({ streamKey, snapshot })
    }
}

describe('DataSource', () => {
    let mockInternalCache: unknown
    let mockDynamo: any
    let mockSnapshotContentGenerator: jest.MockedFunction<(streamKey: string) => Promise<TestSnapshotPayload>>
    let mockSingleFlight: jest.MockedFunction<any>
    let dataSource: TestDataSource<TestSnapshotPayload, TestUpdatePayload>

    beforeEach(() => {
        jest.clearAllMocks()
        
        // Mock getCurrentTimestamp to return predictable values
        mockGetCurrentTimestamp.mockReturnValue(100000000)
        
        // Mock internal cache
        mockInternalCache = {}
        
        // Mock DynamoDB utilities
        mockDynamo = {
            putItem: jest.fn().mockResolvedValue(undefined),
            getItem: jest.fn(),
            query: jest.fn(),
            optimisticUpdate: jest.fn()
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
        
        // Create TestDataSource instance
        dataSource = new TestDataSource({
            internalCache: mockInternalCache,
            dynamo: mockDynamo,
            primaryKeyName: 'AssetId',
            dataSourceKey: 'testDataSource',
            snapshotContentGenerator: mockSnapshotContentGenerator,
            snapshotTimeoutMs: 5000
        })
    })

    describe('constructor', () => {
        it('should initialize with provided configuration', () => {
            expect(dataSource.internalCache).toBe(mockInternalCache)
            expect(dataSource.dynamo).toBe(mockDynamo)
            expect(dataSource.primaryKeyName).toBe('AssetId')
            expect(dataSource.dataSourceKey).toBe('testDataSource')
            expect(dataSource.snapshotContentGenerator).toBe(mockSnapshotContentGenerator)
            expect(dataSource._snapshot).toBeUndefined()
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
                internalCache: mockInternalCache,
                dynamo: mockDynamo,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'testDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator
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
            dataSource._snapshot = cachedSnapshot
            
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
            expect(dataSource._snapshot).toBe(storedSnapshot)
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
            dataSource._snapshot = expiredSnapshot
            
            // Mock loadSnapshotFromStore to return undefined (no stored snapshot)
            jest.spyOn(dataSource, 'loadSnapshotFromStore').mockResolvedValue(undefined)
            
            const result = await dataSource.getSnapshot(streamKey)
            
            expect(mockSingleFlight).toHaveBeenCalledWith({
                category: 'snapshot-generation-testDataSource',
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
            dataSource._snapshot = {
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
                AssetId: 'STREAM#testDataSource::test-stream',
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
                internalCache: mockInternalCache,
                dynamo: mockDynamo,
                primaryKeyName: 'EphemeraId',
                dataSourceKey: 'differentDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator
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
                EphemeraId: 'STREAM#differentDataSource::test-stream',
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
                AssetId: 'STREAM#testDataSource::test-stream',
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
                    AssetId: 'STREAM#testDataSource::test-stream',
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
                    AssetId: 'STREAM#testDataSource::test-stream',
                    DataCategory: 'Meta::Snapshot'
                }
            })
            expect(result).toBeUndefined()
        })

        it('should use different primary key names based on constructor', async () => {
            const dataSourceWithDifferentKey = new TestDataSource({
                internalCache: mockInternalCache,
                dynamo: mockDynamo,
                primaryKeyName: 'EphemeraId',
                dataSourceKey: 'differentDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator
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
                    EphemeraId: 'STREAM#differentDataSource::test-stream',
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

    describe('unimplemented methods', () => {
        it('should throw error for streamEvent', async () => {
            await expect(dataSource.streamEvent({ update: 'test' })).rejects.toThrow('Not implemented')
        })

        it('should throw error for initializeSubscription', async () => {
            await expect(dataSource.initializeSubscription({ sessionId: 'SESSION#test' })).rejects.toThrow('Not implemented')
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
                internalCache: mockInternalCache,
                dynamo: mockDynamo,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'complexDataSource',
                snapshotContentGenerator: jest.fn().mockResolvedValue({
                    id: 'complex-id',
                    metadata: { version: 1, tags: ['test'] },
                    data: { key: 'value' }
                })
            })
            
            expect(complexDataSource).toBeDefined()
        })

        it('should work with string UpdatePayload', () => {
            const stringUpdateDataSource = new TestDataSource<TestSnapshotPayload, string>({
                internalCache: mockInternalCache,
                dynamo: mockDynamo,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'stringUpdateDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator
            })
            
            expect(stringUpdateDataSource).toBeDefined()
        })

        it('should work with object UpdatePayload', () => {
            type ObjectUpdate = {
                type: string
                payload: unknown
            }
            
            const objectUpdateDataSource = new TestDataSource<TestSnapshotPayload, ObjectUpdate>({
                internalCache: mockInternalCache,
                dynamo: mockDynamo,
                primaryKeyName: 'AssetId',
                dataSourceKey: 'objectUpdateDataSource',
                snapshotContentGenerator: mockSnapshotContentGenerator
            })
            
            expect(objectUpdateDataSource).toBeDefined()
        })
    })
})
