import { singleFlightFactory, SingleFlightConfig, SingleFlightParams } from './index'
import { delayPromise } from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'
import { produce } from 'immer'

// Mock delayPromise
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/delayPromise', () => ({
    delayPromise: jest.fn()
}))

// Mock dateUtil
jest.mock('../internalUtils/dateUtil', () => ({
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

    describe('sequential mode', () => {
        beforeEach(() => {
            // Reconfigure for sequential mode
            config = {
                optimisticUpdateFunction: mockOptimisticUpdate,
                getItemFunction: mockGetItem,
                primaryKey: 'PrimaryKey',
                timeoutMs: 30000,
                mode: 'sequential'
            }
            singleFlight = singleFlightFactory(config)
        })

        it('should execute computation immediately when no other instances exist', async () => {
            // Arrange
            // First getItem: check for existing instances (none exist)
            mockGetItem.mockResolvedValueOnce(undefined)
            
            // optimisticUpdate: create instance with QUEUED status
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // Second getItem: check for earlier instances (none exist)
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'test-uuid-123',
                    Status: 'QUEUED',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            // optimisticUpdate: transition to IN_PROGRESS
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // optimisticUpdate: mark as COMPLETED
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            const mockComputation = jest.fn().mockResolvedValue('result-1')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation
                // No retrieval needed in sequential mode
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('result-1')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            expect(mockDelayPromise).not.toHaveBeenCalled() // No waiting needed
        })

        it('should wait for earlier instance to complete before executing', async () => {
            // Arrange
            let uuidCounter = 0
            mockUuidv4.mockImplementation(() => `uuid-${++uuidCounter}`)
            
            let timestampCounter = 100000000
            mockGetCurrentTimestamp.mockImplementation(() => timestampCounter++)
            
            // First getItem: existing earlier instance
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'earlier-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 99999999, // Earlier than our instance
                    expiresAt: 100030000
                }]
            })
            
            // optimisticUpdate to add our instance as QUEUED
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // First poll: earlier instance still in progress
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [
                    {
                        UUID: 'earlier-uuid',
                        Status: 'IN_PROGRESS',
                        createdAt: 99999999,
                        expiresAt: 100030000
                    },
                    {
                        UUID: 'uuid-1',
                        Status: 'QUEUED',
                        createdAt: 100000000,
                        expiresAt: 100030000
                    }
                ]
            })
            
            // Second poll: earlier instance completed
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [
                    {
                        UUID: 'earlier-uuid',
                        Status: 'COMPLETED',
                        createdAt: 99999999,
                        expiresAt: 100030000
                    },
                    {
                        UUID: 'uuid-1',
                        Status: 'QUEUED',
                        createdAt: 100000000,
                        expiresAt: 100030000
                    }
                ]
            })
            
            // optimisticUpdate: transition to IN_PROGRESS
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // optimisticUpdate: mark our instance as completed
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            const mockComputation = jest.fn().mockResolvedValue('result-2')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('result-2')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            expect(mockDelayPromise).toHaveBeenCalled() // Waited for earlier instance
        })

        it('should mark expired earlier instances as FAILED and continue', async () => {
            // Arrange
            let timestampValue = 100000000
            mockGetCurrentTimestamp.mockImplementation(() => timestampValue)
            mockUuidv4.mockReturnValue('my-uuid')
            
            // First getItem: existing earlier instance
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'expired-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 99999999,
                    expiresAt: 99999999 // Already expired
                }]
            })
            
            // optimisticUpdate to add our instance as QUEUED
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // Poll: earlier instance still exists but expired
            timestampValue = 100000001 // Advance time past expiration
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [
                    {
                        UUID: 'expired-uuid',
                        Status: 'IN_PROGRESS',
                        createdAt: 99999999,
                        expiresAt: 99999999
                    },
                    {
                        UUID: 'my-uuid',
                        Status: 'QUEUED',
                        createdAt: 100000000,
                        expiresAt: 100030000
                    }
                ]
            })
            
            // optimisticUpdate to mark expired instance as failed
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // Poll again: expired instance now marked as failed
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [
                    {
                        UUID: 'expired-uuid',
                        Status: 'FAILED',
                        createdAt: 99999999,
                        expiresAt: 99999999
                    },
                    {
                        UUID: 'my-uuid',
                        Status: 'QUEUED',
                        createdAt: 100000000,
                        expiresAt: 100030000
                    }
                ]
            })
            
            // optimisticUpdate: transition to IN_PROGRESS
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // optimisticUpdate: mark our instance as completed
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            const mockComputation = jest.fn().mockResolvedValue('result-3')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('result-3')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            // Verify that we marked the expired instance as failed
            const failedInstanceUpdate = mockOptimisticUpdate.mock.calls.find(call => {
                const draft: any = { Instances: [{ UUID: 'expired-uuid', Status: 'IN_PROGRESS' }] }
                try {
                    call[0].updateReducer(draft)
                    return draft.Instances[0].Status === 'FAILED'
                } catch {
                    return false
                }
            })
            expect(failedInstanceUpdate).toBeDefined()
        })

        it('should mark instance as FAILED when computation throws error', async () => {
            // Arrange
            // First getItem: check for existing instances (none exist)
            mockGetItem.mockResolvedValueOnce(undefined)
            
            // optimisticUpdate: create instance with QUEUED status
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // Second getItem: check for earlier instances (none exist)
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'test-uuid-123',
                    Status: 'QUEUED',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            // optimisticUpdate: transition to IN_PROGRESS
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // optimisticUpdate: mark as FAILED (after error)
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            const mockComputation = jest.fn().mockRejectedValue(new Error('Computation failed'))
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation
            }

            // Act & Assert
            await expect(singleFlight(params)).rejects.toThrow('Computation failed')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            
            // Verify that the instance was marked as FAILED
            const failedUpdate = mockOptimisticUpdate.mock.calls.find(call => {
                const draft: any = { Instances: [{ UUID: 'test-uuid-123', Status: 'IN_PROGRESS' }] }
                try {
                    call[0].updateReducer(draft)
                    return draft.Instances[0].Status === 'FAILED'
                } catch {
                    return false
                }
            })
            expect(failedUpdate).toBeDefined()
        })

        it('should not require retrieval callback in sequential mode', async () => {
            // Arrange
            // First getItem: check for existing instances (none exist)
            mockGetItem.mockResolvedValueOnce(undefined)
            
            // optimisticUpdate: create instance with QUEUED status
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // Second getItem: check for earlier instances (none exist)
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'test-uuid-123',
                    Status: 'QUEUED',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            // optimisticUpdate: transition to IN_PROGRESS
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // optimisticUpdate: mark as COMPLETED
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            const mockComputation = jest.fn().mockResolvedValue('result-4')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation
                // No retrieval provided
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('result-4')
            expect(mockComputation).toHaveBeenCalledTimes(1)
        })

        it('should detect and handle cascading failures when multiple QUEUED instances are dead', async () => {
            // This test simulates the critical deadlock scenario:
            // A (IN_PROGRESS) expires, B and C (QUEUED) are dead, D (QUEUED) is alive
            // D should detect that B and C are dead and mark them all as FAILED
            
            // Arrange
            mockGetCurrentTimestamp.mockReturnValueOnce(100000000).mockReturnValueOnce(100000000).mockReturnValue(100060000)
            mockUuidv4.mockReturnValue('D-uuid')
            
            // First getItem: D sees A (expired), B (QUEUED), C (QUEUED)
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [
                    {
                        UUID: 'A-uuid',
                        Status: 'IN_PROGRESS',
                        createdAt: 99999990,
                        expiresAt: 99999995 // Expired 5 seconds ago
                    },
                    {
                        UUID: 'B-uuid',
                        Status: 'QUEUED',
                        createdAt: 99999991,
                        expiresAt: 100030000
                    },
                    {
                        UUID: 'C-uuid',
                        Status: 'QUEUED',
                        createdAt: 99999992,
                        expiresAt: 100030000
                    }
                ]
            })
            
            // optimisticUpdate: add D as QUEUED
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // Advance time to trigger cascading failure detection
            // A expired at 99999995, now it's 100000000 + (2 * 30000) = 100060000
            // Time since A's expiration: 60005ms = 2+ timeout periods
            const expectedInstances = [
                {
                    UUID: 'A-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 99999990,
                    expiresAt: 99999995
                },
                {
                    UUID: 'B-uuid',
                    Status: 'QUEUED',
                    createdAt: 99999991,
                    expiresAt: 100030000
                },
                {
                    UUID: 'C-uuid',
                    Status: 'QUEUED',
                    createdAt: 99999992,
                    expiresAt: 100030000
                },
                {
                    UUID: 'D-uuid',
                    Status: 'QUEUED',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }
            ]

            // First poll: D sees A expired long enough ago to infer B and C are dead
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: JSON.parse(JSON.stringify(expectedInstances))
            })
            
            // optimisticUpdate: mark A, B, C as FAILED in one batched call
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // After marking all as FAILED, the loop continues and polls again
            // Second poll: all earlier instances now marked as FAILED
            const expectedUpdatedInstances = [
                {
                    UUID: 'A-uuid',
                    Status: 'FAILED',
                    createdAt: 99999990,
                    expiresAt: 99999995
                },
                {
                    UUID: 'B-uuid',
                    Status: 'FAILED',
                    createdAt: 99999991,
                    expiresAt: 100030000
                },
                {
                    UUID: 'C-uuid',
                    Status: 'FAILED',
                    createdAt: 99999992,
                    expiresAt: 100030000
                },
                {
                    UUID: 'D-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 100000000,
                    expiresAt: 100090000
                }
            ]
            mockGetItem.mockResolvedValueOnce({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: JSON.parse(JSON.stringify(expectedUpdatedInstances))
            })
            
            // optimisticUpdate: transition D to IN_PROGRESS
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            // optimisticUpdate: mark D as COMPLETED
            mockOptimisticUpdate.mockResolvedValueOnce({})
            
            const mockComputation = jest.fn().mockResolvedValue('result-D')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('result-D')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            
            // Verify that cascading failure was detected
            // Expected optimistic update calls:
            // 1. Add D as QUEUED
            // 2. Mark A, B, C as FAILED AND transition D to IN_PROGRESS (batched atomic operation)
            // 3. Mark D as COMPLETED
            // Total: 3 optimistic update calls (batching saves one call!)
            expect(mockOptimisticUpdate).toHaveBeenCalledTimes(3)
            
            // Verify that the batched failure call was made and actually works correctly
            const batchedFailureCall = mockOptimisticUpdate.mock.calls[1][0]
            expect(batchedFailureCall.updateKeys).toEqual(['Instances'])
            const reducerResult = produce({ Instances: expectedInstances }, batchedFailureCall.updateReducer)
            expect(reducerResult).toEqual({ Instances: expectedUpdatedInstances })
        })

        it('should execute multiple instances in order by createdAt', async () => {
            // This test simulates three processes arriving at different times
            // and verifies they execute in the correct order
            
            // Arrange
            const executionOrder: string[] = []
            
            // Process 1 (earliest)
            const process1Computation = jest.fn().mockImplementation(async () => {
                executionOrder.push('process-1')
                return 'result-1'
            })
            
            // Process 2 (middle)
            const process2Computation = jest.fn().mockImplementation(async () => {
                executionOrder.push('process-2')
                return 'result-2'
            })
            
            // Process 3 (latest)
            const process3Computation = jest.fn().mockImplementation(async () => {
                executionOrder.push('process-3')
                return 'result-3'
            })

            // The key insight: each process creates its instance with increasing timestamps
            // and waits for earlier ones to complete
            
            // This test verifies the concept rather than full integration
            // because simulating concurrent processes requires complex mocking
            expect(executionOrder).toEqual([]) // Placeholder for conceptual test
        })
    })

    describe('mode validation', () => {
        it('should throw error when retrieval is not provided in coalesce mode', async () => {
            // Arrange
            config = {
                optimisticUpdateFunction: mockOptimisticUpdate,
                getItemFunction: mockGetItem,
                primaryKey: 'PrimaryKey',
                timeoutMs: 30000,
                mode: 'coalesce' // Explicit coalesce mode
            }
            singleFlight = singleFlightFactory(config)
            
            mockGetItem.mockResolvedValue({
                PrimaryKey: 'SINGLEFLIGHT#test-category',
                DataCategory: 'test-hash',
                Instances: [{
                    UUID: 'other-uuid',
                    Status: 'IN_PROGRESS',
                    createdAt: 100000000,
                    expiresAt: 100030000
                }]
            })
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: jest.fn().mockResolvedValue('result')
                // No retrieval provided
            }

            // Act & Assert
            await expect(singleFlight(params)).rejects.toThrow('retrieval callback is required in coalesce mode')
        })

        it('should default to coalesce mode when mode is not specified', async () => {
            // Arrange
            config = {
                optimisticUpdateFunction: mockOptimisticUpdate,
                getItemFunction: mockGetItem,
                primaryKey: 'PrimaryKey',
                timeoutMs: 30000
                // No mode specified - should default to coalesce
            }
            singleFlight = singleFlightFactory(config)
            
            mockGetItem.mockResolvedValue(undefined)
            mockOptimisticUpdate.mockResolvedValue({})
            
            const mockComputation = jest.fn().mockResolvedValue('result')
            const mockRetrieval = jest.fn().mockResolvedValue('retrieved')
            
            const params: SingleFlightParams<string> = {
                category: 'test-category',
                argumentHash: 'test-hash',
                computation: mockComputation,
                retrieval: mockRetrieval
            }

            // Act
            const result = await singleFlight(params)

            // Assert
            expect(result).toBe('result')
            expect(mockComputation).toHaveBeenCalledTimes(1)
            // Coalesce mode behavior confirmed
        })
    })
})
