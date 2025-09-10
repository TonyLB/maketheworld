import { delayPromise } from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'
import { getCurrentTimestamp } from './dateUtil'
import { v4 as uuidv4 } from 'uuid'

export interface SingleFlightConfig {
    optimisticUpdateFunction: (params: any) => Promise<any>
    getItemFunction: (params: any) => Promise<any>
    primaryKey: string
    timeoutMs?: number // Default timeout for instance expiration (defaults to 30000ms)
}

export interface SingleFlightParams<T> {
    category: string
    argumentHash: string
    computation: () => Promise<T>
    retrieval: () => Promise<T>
}

export interface SingleFlightInstance {
    UUID: string
    Status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
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
    
    return async (params: SingleFlightParams<T>): Promise<T> => {
        const { category, argumentHash, computation, retrieval } = params
        const primaryKey = `SINGLEFLIGHT#${category}`
        
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
                retrieval,
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
                            retrieval,
                            computation
                        )
                    }
                }
                throw error
            }
        }
    }
}

// Helper function to create a new instance
async function createNewInstance(
    config: SingleFlightConfig,
    primaryKey: string,
    argumentHash: string,
    existingRecord: SingleFlightRecord<any, any> | undefined,
    timeoutMs: number
): Promise<SingleFlightInstance> {
    const newInstance: SingleFlightInstance = {
        UUID: uuidv4(),
        Status: 'IN_PROGRESS',
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

export default singleFlightFactory
