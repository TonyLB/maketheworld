import { delayPromise } from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'
import { v4 as uuidv4 } from 'uuid'

export interface SingleFlightConfig {
    optimisticUpdateFunction: (params: any) => Promise<any>
    getItemFunction: (params: any) => Promise<any>
    primaryKey: string
    timeoutMs?: number // Default timeout for instance expiration (defaults to 30000ms)
    mode?: 'coalesce' | 'sequential' // Default 'coalesce': share results; 'sequential': execute independently in order
}

export interface SingleFlightParams<T> {
    category: string
    argumentHash: string
    computation: () => Promise<T>
    retrieval?: () => Promise<T> // Optional in sequential mode (required in coalesce mode)
}

export interface SingleFlightInstance {
    UUID: string
    Status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    createdAt: number
    expiresAt: number
}

export type SingleFlightRecord<KInternal extends string = string, KeyType extends string = string> = 
    { [key in KInternal]: KeyType } & 
    {
        DataCategory: string 
        Instances: SingleFlightInstance[]
    }

export const singleFlightFactory = <T>(config: SingleFlightConfig) => {
    const timeoutMs = config.timeoutMs ?? 30000
    const mode = config.mode ?? 'coalesce'
    
    return async (params: SingleFlightParams<T>): Promise<T> => {
        const { category, argumentHash, computation, retrieval } = params
        const primaryKey = `SINGLEFLIGHT#${category}`
        
        // Validate retrieval is provided in coalesce mode
        if (mode === 'coalesce' && !retrieval) {
            throw new Error('retrieval callback is required in coalesce mode')
        }
        
        if (mode === 'sequential') {
            return await executeSequential(
                config,
                primaryKey,
                argumentHash,
                computation,
                timeoutMs
            )
        }
        
        // Coalesce mode (original behavior)
        // Step 1: Check for existing record
        const existingRecord = await config.getItemFunction({
            Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
            ProjectionFields: ['Instances']
        })
        
        // Step 2: Look for IN_PROGRESS instances
        const inProgressInstance = existingRecord?.Instances?.find(
            (instance: SingleFlightInstance) => instance.Status === 'IN_PROGRESS'
        )
        
        if (inProgressInstance) {
            // Step 3: Associate with existing IN_PROGRESS instance and poll
            return await pollForCompletion(
                config,
                primaryKey,
                argumentHash,
                inProgressInstance,
                retrieval!,
                computation
            )
        } else {
            // Step 4: Try to create new instance and become leader
            try {
                const newInstance = await createNewInstance(
                    config,
                    primaryKey,
                    argumentHash,
                    existingRecord,
                    timeoutMs
                )
                
                // Step 5: Perform computation as leader
                const result = await computation()
                
                // Step 6: Mark instance as completed
                await markInstanceCompleted(
                    config,
                    primaryKey,
                    argumentHash,
                    newInstance.UUID
                )
                
                return result
            } catch (error: any) {
                if (error.code === 'ConditionalCheckFailedException') {
                    // Race condition - fall back to polling
                    const currentRecord = await config.getItemFunction({
                        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
                        ProjectionFields: ['Instances']
                    })
                    const currentInProgressInstance = currentRecord?.Instances?.find(
                        (instance: SingleFlightInstance) => instance.Status === 'IN_PROGRESS'
                    )
                    
                    if (currentInProgressInstance) {
                        return await pollForCompletion(
                            config,
                            primaryKey,
                            argumentHash,
                            currentInProgressInstance,
                            retrieval!,
                            computation
                        )
                    }
                }
                throw error
            }
        }
    }
}

// Helper function to execute in sequential mode
async function executeSequential<T>(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    computation: () => Promise<T>,
    timeoutMs: number
): Promise<T> {
    // Step 1: Create our instance with QUEUED status
    const existingRecord = await config.getItemFunction({
        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
        ProjectionFields: ['Instances']
    })
    
    const myInstance = await createNewInstance(
        config,
        primaryKey,
        argumentHash,
        existingRecord,
        timeoutMs,
        'QUEUED'  // Start in QUEUED status for sequential mode
    )
    
    // Step 2: Wait for all earlier instances to complete
    // This may batch the transition to IN_PROGRESS with marking dead instances as FAILED
    const transitionedInWait = await waitForEarlierInstances(
        config,
        primaryKey,
        argumentHash,
        myInstance,
        timeoutMs
    )
    
    // Step 3: Transition to IN_PROGRESS if not already done during wait
    if (!transitionedInWait) {
        await transitionToInProgress(
            config,
            primaryKey,
            argumentHash,
            myInstance.UUID,
            timeoutMs
        )
    }
    
    // Step 4: Execute our computation
    try {
        const result = await computation()
        
        // Step 5: Mark our instance as completed
        await markInstanceCompleted(
            config,
            primaryKey,
            argumentHash,
            myInstance.UUID
        )
        
        return result
    } catch (error) {
        // Mark instance as failed
        await markInstanceFailed(
            config,
            primaryKey,
            argumentHash,
            myInstance.UUID
        )
        throw error
    }
}

// Helper function to wait for earlier instances to complete
// Returns true if it transitioned myInstance to IN_PROGRESS during cascading failure handling
async function waitForEarlierInstances(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    myInstance: SingleFlightInstance,
    timeoutMs: number
): Promise<boolean> {
    
    while (true) {
        const record = await config.getItemFunction({
            Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
            ProjectionFields: ['Instances']
        })
        
        if (!record?.Instances) {
            return false // No instances, caller should transition
        }
        
        // TODO: Implement cleanup for old COMPLETED/FAILED instances to prevent unbounded growth
        // Current impact: ~2500-4000 instances before hitting 400KB DynamoDB limit
        // Recommended approach: Remove instances where expiresAt is older than 10x the timeout period
        // (i.e., if timeout is 30s, remove instances expired more than 300s ago)
        // This cleanup should be opportunistic (run during normal polling) to avoid separate maintenance jobs
        
        // Check our own status - another process may have marked us as FAILED
        const currentInstance = record.Instances.find(
            (inst: SingleFlightInstance) => inst.UUID === myInstance.UUID
        )
        
        if (!currentInstance) {
            throw new Error('Instance not found during waiting')
        }
        
        if (currentInstance.Status === 'FAILED') {
            throw new Error('Instance was marked as FAILED by another process (cascading failure)')
        }
        
        // Find all instances created before ours that are still QUEUED or IN_PROGRESS
        const earlierActive = record.Instances.filter(
            (inst: SingleFlightInstance) => 
                inst.createdAt < myInstance.createdAt && 
                (inst.Status === 'QUEUED' || inst.Status === 'IN_PROGRESS')
        )
        
        // If no earlier instances are active, we can proceed
        if (earlierActive.length === 0) {
            return false // Caller should transition to IN_PROGRESS
        }
        
        const currentTime = getCurrentTimestamp()
        
        // Check for cascading failures: if an IN_PROGRESS instance expired long enough ago
        // that all QUEUED instances ahead of us should have also failed, mark them all as FAILED
        const expiredInProgress = earlierActive.find(
            inst => inst.Status === 'IN_PROGRESS' && currentTime > inst.expiresAt
        )
        
        if (expiredInProgress) {
            const timeSinceExpiration = currentTime - expiredInProgress.expiresAt
            const queuedEarlier = earlierActive.filter(inst => inst.Status === 'QUEUED')
            
            // If enough time has passed for all QUEUED instances to have transitioned and timed out,
            // they must be dead (not polling anymore). Mark them all as FAILED and transition us to IN_PROGRESS.
            if (queuedEarlier.length > 0 && timeSinceExpiration >= queuedEarlier.length * timeoutMs) {
                // Cascading failure detected - mark all earlier instances as FAILED and transition to IN_PROGRESS atomically
                try {
                    const myCreatedAt = myInstance.createdAt
                    const myUUID = myInstance.UUID
                    await config.optimisticUpdateFunction({
                        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
                        updateKeys: ['Instances'],
                        updateReducer: (draft: any) => {
                            // Recalculate which instances should be marked as FAILED from current state
                            // Mark all instances created before ours that are QUEUED or IN_PROGRESS
                            for (const instance of draft.Instances) {
                                if (instance.createdAt < myCreatedAt && 
                                    (instance.Status === 'QUEUED' || instance.Status === 'IN_PROGRESS')) {
                                    instance.Status = 'FAILED'
                                }
                            }
                            
                            // Also transition our instance to IN_PROGRESS in the same atomic operation
                            const myInstanceDraft = draft.Instances.find(
                                (inst: SingleFlightInstance) => inst.UUID === myUUID
                            )
                            if (myInstanceDraft) {
                                const timestamp = getCurrentTimestamp()
                                myInstanceDraft.Status = 'IN_PROGRESS'
                                myInstanceDraft.expiresAt = timestamp + timeoutMs
                            }
                        },
                        maxRetries: 0
                    })
                    return true // We transitioned to IN_PROGRESS
                } catch (error) {
                    // Ignore errors - another process may have updated it
                    // Fall through to continue polling
                }
            }
            
            // Not a cascading failure yet - just mark the expired IN_PROGRESS instance
            try {
                await markInstanceFailed(
                    config,
                    primaryKey,
                    argumentHash,
                    expiredInProgress.UUID
                )
            } catch (error) {
                // Ignore errors - another process may have updated it
            }
        }
        
        // Wait before next poll
        const baseDelay = 100
        const jitter = Math.random() * 50
        const delay = baseDelay + jitter
        await delayPromise(delay)
    }
}

// Helper function to create a new instance
async function createNewInstance(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    existingRecord: SingleFlightRecord<any, any> | undefined,
    timeoutMs: number,
    initialStatus: 'QUEUED' | 'IN_PROGRESS' = 'IN_PROGRESS'
): Promise<SingleFlightInstance> {
    const newInstance: SingleFlightInstance = {
        UUID: uuidv4(),
        Status: initialStatus,
        createdAt: getCurrentTimestamp(),
        expiresAt: getCurrentTimestamp() + timeoutMs
    }
    
    const updatedRecord = await config.optimisticUpdateFunction({
        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
        updateKeys: ['Instances'],
        updateReducer: (draft: any) => {
            if (!draft.Instances) {
                draft.Instances = []
            }
            draft.Instances.push(newInstance)
        },
        priorFetch: existingRecord,
        maxRetries: 0 // Try only once
    })
    
    return newInstance
}

// Helper function to poll for completion
async function pollForCompletion<T>(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    instance: SingleFlightInstance,
    retrieval: () => Promise<T>,
    computation: () => Promise<T>
): Promise<T> {
    // Poll for completion
    while (true) {
        const record = await config.getItemFunction({
            Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
            ProjectionFields: ['Instances']
        })
        
        // TODO: Implement cleanup for old COMPLETED/FAILED instances to prevent unbounded growth
        // Same issue as sequential mode - instances accumulate indefinitely
        // Recommended: Remove instances where expiresAt is older than 10x the timeout period
        
        const currentInstance = record?.Instances?.find(
            (inst: SingleFlightInstance) => inst.UUID === instance.UUID
        )
        
        if (!currentInstance) {
            throw new Error('Instance not found during polling')
        }
        
        if (currentInstance.Status === 'COMPLETED') {
            return await retrieval()
        }
        
        if (currentInstance.Status === 'FAILED') {
            throw new Error('Computation failed')
        }
        
        // Check if instance has expired (using current time and the instance's expiresAt)
        const currentTime = getCurrentTimestamp()
        if (currentTime > currentInstance.expiresAt) {
            // Self-promote: take over the expired instance
            return await selfPromote(config, primaryKey, argumentHash, currentInstance, computation, record)
        }
        
        // Wait before next poll
        const baseDelay = 100
        const jitter = Math.random() * 50
        const delay = baseDelay + jitter
        await delayPromise(delay)
    }
}

// Helper function for self-promotion
async function selfPromote<T>(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    expiredInstance: SingleFlightInstance,
    computation: () => Promise<T>,
    priorFetch?: SingleFlightRecord<any, any>
): Promise<T> {
    // Update the expired instance with new timestamps
    const updatedInstance = {
        ...expiredInstance,
        createdAt: getCurrentTimestamp(),
        expiresAt: getCurrentTimestamp() + (config.timeoutMs ?? 30000)
    }
    
    await config.optimisticUpdateFunction({
        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
        updateKeys: ['Instances'],
        updateReducer: (draft: any) => {
            const instanceIndex = draft.Instances.findIndex(
                (inst: SingleFlightInstance) => inst.UUID === expiredInstance.UUID
            )
            if (instanceIndex === -1) {
                throw new Error(`Instance with UUID ${expiredInstance.UUID} not found during self-promotion`)
            }
            draft.Instances[instanceIndex] = updatedInstance
        },
        priorFetch: priorFetch,
        maxRetries: 0
    })
    
    // Perform computation as new leader
    const result = await computation()
    
    // Mark as completed
    await markInstanceCompleted(config, primaryKey, argumentHash, expiredInstance.UUID)
    
    return result
}

// Helper function to mark instance as completed
async function markInstanceCompleted(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    instanceUUID: string
): Promise<void> {
    await config.optimisticUpdateFunction({
        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
        updateKeys: ['Instances'],
        updateReducer: (draft: any) => {
            const instanceIndex = draft.Instances.findIndex(
                (inst: SingleFlightInstance) => inst.UUID === instanceUUID
            )
            if (instanceIndex === -1) {
                throw new Error(`Instance with UUID ${instanceUUID} not found during completion`)
            }
            draft.Instances[instanceIndex].Status = 'COMPLETED'
        },
        maxRetries: 0
    })
}

// Helper function to mark instance as failed
async function markInstanceFailed(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    instanceUUID: string
): Promise<void> {
    await config.optimisticUpdateFunction({
        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
        updateKeys: ['Instances'],
        updateReducer: (draft: any) => {
            const instanceIndex = draft.Instances.findIndex(
                (inst: SingleFlightInstance) => inst.UUID === instanceUUID
            )
            if (instanceIndex === -1) {
                throw new Error(`Instance with UUID ${instanceUUID} not found during failure marking`)
            }
            draft.Instances[instanceIndex].Status = 'FAILED'
        },
        maxRetries: 0
    })
}

// Helper function to transition instance from QUEUED to IN_PROGRESS
async function transitionToInProgress(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    instanceUUID: string,
    timeoutMs: number
): Promise<void> {
    await config.optimisticUpdateFunction({
        Key: { [config.primaryKey]: primaryKey, DataCategory: argumentHash },
        updateKeys: ['Instances'],
        updateReducer: (draft: any) => {
            const instanceIndex = draft.Instances.findIndex(
                (inst: SingleFlightInstance) => inst.UUID === instanceUUID
            )
            if (instanceIndex === -1) {
                throw new Error(`Instance with UUID ${instanceUUID} not found during transition to IN_PROGRESS`)
            }
            draft.Instances[instanceIndex].Status = 'IN_PROGRESS'
            // Reset expiration time when actually starting execution
            draft.Instances[instanceIndex].expiresAt = getCurrentTimestamp() + timeoutMs
        },
        maxRetries: 0
    })
}

export default singleFlightFactory
