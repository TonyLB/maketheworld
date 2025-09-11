export type SerializableObject = Record<string, unknown>

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

type SnapshotType<SnapshotPayload extends SerializableObject> = SnapshotPayload & {
    createdAt: number;
    expiresAt: number;
}

export class DataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject> {
    readonly internalCache: unknown
    readonly dynamo: DynamoUtils
    readonly pkName: string
    readonly primaryKeyName: string
    readonly snapshotContentGenerator: (streamKey: string) => Promise<SnapshotPayload>
    _snapshot: SnapshotType<SnapshotPayload> | undefined

    constructor({ 
        internalCache, 
        dynamo, 
        pkName, 
        primaryKeyName,
        snapshotContentGenerator
    }: { 
        internalCache: unknown, 
        dynamo: DynamoUtils, 
        pkName: string,
        primaryKeyName: string,
        snapshotContentGenerator: (streamKey: string) => Promise<SnapshotPayload>
    }) {
        this.internalCache = internalCache
        this.dynamo = dynamo
        this.pkName = pkName
        this.primaryKeyName = primaryKeyName
        this.snapshotContentGenerator = snapshotContentGenerator
        this._snapshot = undefined
    }

    async generateSnapshot(streamKey: string): Promise<SnapshotType<SnapshotPayload>> {
        const now = Date.now()
        const content = await this.snapshotContentGenerator(streamKey)
        return {
            ...content,
            createdAt: now,
            expiresAt: now + 300000 // 5 minutes default expiration
        }
    }

    async getSnapshot(streamKey: string): Promise<SnapshotPayload> {
        if (this._snapshot && Date.now() <= this._snapshot.expiresAt) {
            return this._snapshot
        }

        const loaded = await this.loadSnapshotFromStore(streamKey).catch(() => undefined)
        if (loaded && Date.now() <= loaded.expiresAt) {
            this._snapshot = loaded
            return loaded
        }

        const generated = await this.generateSnapshot(streamKey)
        this._snapshot = generated
        await this.storeSnapshotToStore({ streamKey, snapshot: generated }).catch(() => undefined)
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

    protected async storeSnapshotToStore({ streamKey: _streamKey, snapshot: _snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        throw new Error('Not implemented')
    }
}


