import { singleFlightFactory, SingleFlightConfig } from '../singleFlight'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'

export type SerializableObject = Record<string, unknown>

export type SnapshotType<SnapshotPayload extends SerializableObject> = SnapshotPayload & {
    createdAt: number;
    expiresAt: number;
}

export type DynamoGetItemArgs = {
    Key: Record<string, string>
    ProjectionFields?: string[]
    getAllFields?: boolean
    ExpressionAttributeNames?: Record<string, string>
    ConsistentRead?: boolean
}

export type DynamoQueryArgs = {
    Key: Record<string, string>
    IndexName?: '' | 'DataCategoryIndex' | 'ScopedIdIndex' | 'PlayerIndex' | 'ZoneIndex' | 'ConnectionIndex'
    ProjectionFields?: string[]
    KeyConditionExpression?: string
    ExpressionAttributeValues?: Record<string, any>
    FilterExpression?: string
    allFields?: boolean
}

export type DynamoUtils = {
    putItem: (item: Record<string, any>) => Promise<unknown>
    getItem: <Get>(args: DynamoGetItemArgs) => Promise<Get | undefined>
    query: <Q>(args: DynamoQueryArgs) => Promise<Q[]>
    optimisticUpdate: (params: any) => Promise<any>
}

export class DataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject> {
    readonly internalCache: unknown
    readonly dynamo: DynamoUtils
    readonly primaryKeyName: string
    readonly dataSourceKey: string
    readonly snapshotContentGenerator: (streamKey: string) => Promise<SnapshotPayload>
    readonly singleFlight: ReturnType<typeof singleFlightFactory<SnapshotType<SnapshotPayload>>>
    _snapshot: SnapshotType<SnapshotPayload> | undefined

    constructor({ 
        internalCache, 
        dynamo, 
        primaryKeyName,
        dataSourceKey,
        snapshotContentGenerator,
        snapshotTimeoutMs = 5000
    }: { 
        internalCache: unknown, 
        dynamo: DynamoUtils, 
        primaryKeyName: string,
        dataSourceKey: string,
        snapshotContentGenerator: (streamKey: string) => Promise<SnapshotPayload>,
        snapshotTimeoutMs?: number
    }) {
        this.internalCache = internalCache
        this.dynamo = dynamo
        this.primaryKeyName = primaryKeyName
        this.dataSourceKey = dataSourceKey
        this.snapshotContentGenerator = snapshotContentGenerator
        this._snapshot = undefined

        // Initialize singleFlight for snapshot generation coordination
        const singleFlightConfig: SingleFlightConfig = {
            optimisticUpdateFunction: dynamo.optimisticUpdate,
            getItemFunction: dynamo.getItem,
            primaryKey: primaryKeyName,
            timeoutMs: snapshotTimeoutMs
        }
        this.singleFlight = singleFlightFactory<SnapshotType<SnapshotPayload>>(singleFlightConfig)
    }

    async generateSnapshot(streamKey: string): Promise<SnapshotType<SnapshotPayload>> {
        const now = getCurrentTimestamp()
        const content = await this.snapshotContentGenerator(streamKey)
        return {
            ...content,
            createdAt: now,
            expiresAt: now + 300000 // 5 minutes default expiration
        }
    }

    async getSnapshot(streamKey: string): Promise<SnapshotPayload> {
        // Check in-memory cache first
        if (this._snapshot && getCurrentTimestamp() <= this._snapshot.expiresAt) {
            return this._snapshot
        }

        // Try to load from store
        const loaded = await this.loadSnapshotFromStore(streamKey).catch(() => undefined)
        if (loaded && getCurrentTimestamp() <= loaded.expiresAt) {
            this._snapshot = loaded
            return loaded
        }

        // Use singleFlight to coordinate snapshot generation
        const generated = await this.singleFlight({
            category: `snapshot-generation-${this.dataSourceKey}`,
            argumentHash: streamKey, // Use streamKey as the argument hash
            computation: async () => {
                // Perform the actual snapshot generation and storage
                const snapshot = await this.generateSnapshot(streamKey)
                await this.storeSnapshotToStore({ streamKey, snapshot }).catch(() => undefined)
                return snapshot
            },
            retrieval: async () => {
                // Retrieve the snapshot that was just stored by the computation
                const stored = await this.loadSnapshotFromStore(streamKey)
                if (!stored) {
                    throw new Error('Snapshot not found after computation completed')
                }
                return stored
            }
        })

        this._snapshot = generated
        return generated
    }

    async streamEvent({ update: _update }: { update: UpdatePayload }): Promise<void> {
        throw new Error('Not implemented')
    }

    async initializeSubscription({ sessionId }: { sessionId: `SESSION#${string}` }): Promise<void> {
        throw new Error('Not implemented')
    }

    protected async loadSnapshotFromStore(streamKey: string): Promise<SnapshotType<SnapshotPayload> | undefined> {
        throw new Error('Not implemented')
    }

    protected async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        await this.dynamo.putItem({
            [this.primaryKeyName]: primaryKey,
            DataCategory: 'Meta::Snapshot',
            ...snapshot
        })
    }
}


