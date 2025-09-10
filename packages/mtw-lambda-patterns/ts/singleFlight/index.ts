import { delayPromise } from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'

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

export interface SingleFlightRecord {
    PrimaryKey: string
    DataCategory: string
    Instances: SingleFlightInstance[]
}

export const singleFlightFactory = <T>(config: SingleFlightConfig) => {
    return async (params: SingleFlightParams<T>): Promise<T> => {
        // TODO: Implement singleFlight logic
        throw new Error('singleFlight not yet implemented')
    }
}

export default singleFlightFactory
