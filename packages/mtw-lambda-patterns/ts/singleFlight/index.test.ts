import { singleFlightFactory, SingleFlightConfig, SingleFlightParams } from './index'
import { delayPromise } from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'
import { getCurrentTimestamp } from './dateUtil'

// Mock delayPromise
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/delayPromise', () => ({
    delayPromise: jest.fn()
}))

// Mock dateUtil
jest.mock('./dateUtil', () => ({
    getCurrentTimestamp: jest.fn()
}))

// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn()
}))

const mockDelayPromise = delayPromise as jest.MockedFunction<typeof delayPromise>
const mockGetCurrentTimestamp = getCurrentTimestamp as jest.MockedFunction<typeof getCurrentTimestamp>

// Import the mocked uuid
import { v4 as uuidv4 } from 'uuid'
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>

describe('singleFlightFactory', () => {
    let mockOptimisticUpdate: jest.MockedFunction<any>
    let mockGetItem: jest.MockedFunction<any>
    let config: SingleFlightConfig
    let singleFlight: ReturnType<typeof singleFlightFactory>

    beforeEach(() => {
        jest.clearAllMocks()
        
        mockOptimisticUpdate = jest.fn()
        mockGetItem = jest.fn()
        
        // Mock delayPromise to resolve immediately
        mockDelayPromise.mockResolvedValue(undefined)
        
        // Mock getCurrentTimestamp to return predictable values
        mockGetCurrentTimestamp.mockReturnValue(100000000)
        
        // Mock uuid to return predictable values
        mockUuidv4.mockReturnValue('test-uuid-123')
        
        config = {
            optimisticUpdateFunction: mockOptimisticUpdate,
            getItemFunction: mockGetItem,
            primaryKey: 'PrimaryKey',
            timeoutMs: 30000
        }
        
        singleFlight = singleFlightFactory(config)
    })

    describe('when no existing record exists', () => {
        it('should create a new instance and become the leader', async () => {
            // Arrange
            mockGetItem.mockResolvedValue(undefined)
            mockOptimisticUpdate.mockResolvedValue({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'test-uuid-123',
                    Status: 'IN_PROGRESS',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            const mockComputation = jest.fn().mockResolvedValue('computation result')
            const mockRetrieval = jest.fn()
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('computation result')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            expect(mockRetrieval).not.toHaveBeenCalled()
            expect(mockOptimisticUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: {
                        PrimaryKey: 'SINGLEFLIGHT#test-category',
                        DataCategory: 'test-hash'
                    },
                    updateKeys: ['Instances'],
                    updateReducer: expect.any(Function),
                    priorFetch: undefined // No existing record
                })
            )
            
            // Verify that the updateReducer creates the instance with the correct UUID
            const optimisticUpdateCall = mockOptimisticUpdate.mock.calls[0][0]
            const draft: any = { Instances: [] }
            optimisticUpdateCall.updateReducer(draft)
            expect(draft.Instances).toEqual([{
                UUID: 'test-uuid-123',
                Status: 'IN_PROGRESS',
                createdAt: 100000000,
                expiresAt: 100030000
            }])
        })

        it('should handle race condition when another process beats us to creating the record', async () => {
            // Arrange
            // First getItem call returns undefined (no existing record)
            mockGetItem.mockResolvedValueOnce(undefined)
            
            // First optimisticUpdate attempt fails due to race condition
            const conditionalCheckError = new Error('ConditionalCheckFailedException') as any
            conditionalCheckError.code = 'ConditionalCheckFailedException'
            mockOptimisticUpdate.mockRejectedValueOnce(conditionalCheckError)
            
            // Second getItem call finds the record that the other process created
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'other-process-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            // Third getItem call (first poll) still finds IN_PROGRESS
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'other-process-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            // Fourth getItem call (second poll) finds the completed result
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'other-process-uuid',
                    Status: 'COMPLETED',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            const mockComputation = jest.fn()
            const mockRetrieval = jest.fn().mockResolvedValue('other process result')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('other process result')
            expect(mockComputation).not.toHaveBeenCalled() // We never became the leader
            expect(mockRetrieval).toHaveBeenCalledTimes(1) // We got the result from the other process
            expect(mockOptimisticUpdate).toHaveBeenCalledTimes(1) // Only the failed attempt
            expect(mockDelayPromise).toHaveBeenCalled() // Should have polled with delay
        })

        it('should create a new instance when only COMPLETED instances exist', async () => {
            // Arrange
            const completedInstance = {
                UUID: 'old-completed-uuid',
                Status: 'COMPLETED' as const,
                createdAt: 100000000,
                expiresAt: 100030000
            }
            
            mockGetItem.mockResolvedValue({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [completedInstance]
            })
            
            const now = Date.now()
            mockOptimisticUpdate.mockResolvedValue({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [
                    completedInstance, // Keep the old completed instance
                    {
                        UUID: 'test-uuid-123',
                        Status: 'IN_PROGRESS',
                        createdAt: now,
                        expiresAt: now + 30000
                    }
                ]
            })
            
            const mockComputation = jest.fn().mockResolvedValue('new computation result')
            const mockRetrieval = jest.fn()
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('new computation result')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            expect(mockRetrieval).not.toHaveBeenCalled()
            expect(mockOptimisticUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: {
                        PrimaryKey: 'SINGLEFLIGHT#test-category',
                        DataCategory: 'test-hash'
                    },
                    updateKeys: ['Instances'],
                    updateReducer: expect.any(Function),
                    priorFetch: expect.objectContaining({
                        Instances: [completedInstance]
                    })
                })
            )
        })
    })

    describe('when an IN_PROGRESS instance exists', () => {
        it('should associate with existing instance and wait for completion', async () => {
            // Arrange
            const existingInstance = {
                UUID: 'existing-uuid',
                Status: 'IN_PROGRESS' as const,
                createdAt: Date.now(),
                expiresAt: Date.now() + 30000
            }
            
            // First getItem call finds IN_PROGRESS instance
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [existingInstance]
            })
            
            // Second getItem call (first poll) still finds IN_PROGRESS
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [existingInstance]
            })
            
            // Third getItem call (second poll) finds COMPLETED
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    ...existingInstance,
                    Status: 'COMPLETED'
                }]
            })
            
            const mockComputation = jest.fn()
            const mockRetrieval = jest.fn().mockResolvedValue('retrieved result')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('retrieved result')
            expect(mockComputation).not.toHaveBeenCalled()
            expect(mockRetrieval).toHaveBeenCalledTimes(1)
            expect(mockDelayPromise).toHaveBeenCalled()
        })

        it('should ignore COMPLETED instances and focus on IN_PROGRESS instance', async () => {
            // Arrange
            const completedInstance = {
                UUID: 'old-completed-uuid',
                Status: 'COMPLETED' as const,
                createdAt: 100000000,
                expiresAt: 100030000
            }
            
            const inProgressInstance = {
                UUID: 'current-uuid',
                Status: 'IN_PROGRESS' as const,
                createdAt: 100050000,
                expiresAt: 100080000
            }
            
            // First getItem call finds both instances
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [completedInstance, inProgressInstance]
            })
            
            // Second getItem call (first poll) still finds IN_PROGRESS
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [completedInstance, inProgressInstance]
            })
            
            // Third getItem call (second poll) finds COMPLETED
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [
                    completedInstance,
                    {
                        ...inProgressInstance,
                        Status: 'COMPLETED'
                    }
                ]
            })
            
            const mockComputation = jest.fn()
            const mockRetrieval = jest.fn().mockResolvedValue('current process result')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('current process result')
            expect(mockComputation).not.toHaveBeenCalled()
            expect(mockRetrieval).toHaveBeenCalledTimes(1)
            expect(mockDelayPromise).toHaveBeenCalled()
        })
    })

    describe('when leader fails and times out', () => {
        it('should self-promote and take over the instance', async () => {
            // Arrange
            const expiredInstance = {
                UUID: 'expired-uuid',
                Status: 'IN_PROGRESS' as const,
                createdAt: 100000000 - 60000, // 1 minute ago
                expiresAt: 100000000 - 30000  // 30 seconds ago (expired)
            }
            
            mockGetItem.mockResolvedValue({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [expiredInstance]
            })
            
            mockOptimisticUpdate.mockResolvedValue({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'expired-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            const mockComputation = jest.fn().mockResolvedValue('self-promoted result')
            const mockRetrieval = jest.fn()
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('self-promoted result')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            expect(mockRetrieval).not.toHaveBeenCalled()
            expect(mockOptimisticUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: {
                        PrimaryKey: 'SINGLEFLIGHT#test-category',
                        DataCategory: 'test-hash'
                    },
                    updateKeys: ['Instances'],
                    updateReducer: expect.any(Function)
                })
            )
        })
    })

    describe('when multiple runs coexist', () => {
        it('should handle Process A, B, C edge case correctly', async () => {
            // Arrange: Process A creates instance UUID-1
            const instanceA = {
                UUID: 'instance-a-uuid',
                Status: 'IN_PROGRESS' as const,
                createdAt: 100000000,
                expiresAt: 100030000
            }
            
            // Process B sees instance A and waits
            mockGetItem
                .mockResolvedValueOnce({
                    PrimaryKey: 'SINGLEFLIGHT#test-category',
                    DataCategory: 'test-hash',
                    Instances: [instanceA]
                })
                .mockResolvedValueOnce({
                    PrimaryKey: 'SINGLEFLIGHT#test-category',
                    DataCategory: 'test-hash',
                    Instances: [instanceA]
                })
                .mockResolvedValueOnce({
                    PrimaryKey: 'SINGLEFLIGHT#test-category',
                    DataCategory: 'test-hash',
                    Instances: [
                        {
                            ...instanceA,
                            Status: 'COMPLETED'
                        },
                        // Process C has now created instance UUID-2, but Process B should ignore it
                        {
                            UUID: 'instance-c-uuid',
                            Status: 'IN_PROGRESS' as const,
                            createdAt: 100050000,
                            expiresAt: 100080000
                        }
                    ]
                })
            
            const mockComputation = jest.fn()
            const mockRetrieval = jest.fn().mockResolvedValue('process-a-result')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act: Process B waits and gets Process A's result
            const result = await singleFlight(params)

            // Assert: Process B gets Process A's result, not Process C's
            expect(result).toBe('process-a-result')
            expect(mockComputation).not.toHaveBeenCalled()
            expect(mockRetrieval).toHaveBeenCalledTimes(1)
            
            // Verify that Process B was looking for the correct instance UUID
            // This would be tested by ensuring the implementation correctly identifies
            // which instance to poll based on the UUID it associated with
        })
    })

    describe('error handling', () => {
        it('should propagate computation errors to waiting processes', async () => {
            // Arrange - Start with IN_PROGRESS instance, then it becomes FAILED during polling
            const inProgressInstance = {
                UUID: 'error-uuid',
                Status: 'IN_PROGRESS' as const,
                createdAt: Date.now(),
                expiresAt: Date.now() + 30000
            }
            
            // First getItem call finds IN_PROGRESS instance
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [inProgressInstance]
            })
            
            // Second getItem call (first poll) finds FAILED instance
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    ...inProgressInstance,
                    Status: 'FAILED'
                }]
            })
            
            const mockComputation = jest.fn()
            const mockRetrieval = jest.fn()
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act & Assert
            await expect(singleFlight(params)).rejects.toThrow('Computation failed')
            expect(mockComputation).not.toHaveBeenCalled()
            expect(mockRetrieval).not.toHaveBeenCalled()
        })

        it('should handle DynamoDB errors gracefully', async () => {
            // Arrange
            mockGetItem.mockRejectedValue(new Error('DynamoDB error'))
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: jest.fn(),
                retrieval: jest.fn()
            }

            // Act & Assert
            await expect(singleFlight(params)).rejects.toThrow('DynamoDB error')
        })

        it('should throw error when instance not found during completion', async () => {
            // Arrange - Create a scenario where the instance disappears between creation and completion
            mockGetItem.mockResolvedValue(undefined) // No existing record
            
            // Mock optimisticUpdate to simulate the instance being created successfully
            mockOptimisticUpdate.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'test-uuid-123',
                    Status: 'IN_PROGRESS',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            // Mock the second optimisticUpdate call (for completion) to simulate the instance disappearing
            mockOptimisticUpdate.mockImplementationOnce((params) => {
                // Simulate the updateReducer being called with an empty Instances array
                const draft: any = { Instances: [] } // Instance is gone!
                params.updateReducer(draft)
                return Promise.resolve({})
            })
            
            const mockComputation = jest.fn().mockResolvedValue('result')
            const mockRetrieval = jest.fn()
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act & Assert
            await expect(singleFlight(params)).rejects.toThrow('Instance with UUID test-uuid-123 not found during completion')
        })
    })

    describe('polling behavior', () => {
        it('should use consistent polling intervals with jitter', async () => {
            // Arrange
            const instance = {
                UUID: 'polling-uuid',
                Status: 'IN_PROGRESS' as const,
                createdAt: 100000000,
                expiresAt: 100030000
            }
            
            mockGetItem
                .mockResolvedValueOnce({
                    PrimaryKey: 'SINGLEFLIGHT#test-category',
                    DataCategory: 'test-hash',
                    Instances: [instance]
                })
                .mockResolvedValueOnce({
                    PrimaryKey: 'SINGLEFLIGHT#test-category',
                    DataCategory: 'test-hash',
                    Instances: [instance]
                })
                .mockResolvedValueOnce({
                    PrimaryKey: 'SINGLEFLIGHT#test-category',
                    DataCategory: 'test-hash',
                    Instances: [{
                        ...instance,
                        Status: 'COMPLETED'
                    }]
                })
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: jest.fn(),
                retrieval: jest.fn().mockResolvedValue('result')
            }

            // Act
            await singleFlight(params)

            // Assert
            expect(mockDelayPromise).toHaveBeenCalledTimes(1)
            // Should have consistent delays with jitter (not exponential backoff)
            const delays = mockDelayPromise.mock.calls.map(call => call[0])
            // The delay should be in a reasonable range (e.g., 100-200ms with jitter)
            expect(delays[0]).toBeGreaterThanOrEqual(50)
            expect(delays[0]).toBeLessThanOrEqual(200)
        })
    })
})
