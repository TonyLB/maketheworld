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
}

type SnapshotType<SnapshotPayload extends SerializableObject> = SnapshotPayload & {
    createdAt: number;
    expiresAt: number;
}

export class DataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject> {
    readonly internalCache: unknown
    readonly dynamo: DynamoUtils
    readonly pkName: string
    _snapshot: SnapshotType<SnapshotPayload> | undefined

    constructor({ internalCache, dynamo, pkName }: { internalCache: unknown, dynamo: DynamoUtils, pkName: string }) {
        this.internalCache = internalCache
        this.dynamo = dynamo
        this.pkName = pkName
        this._snapshot = undefined
    }

    async generateSnapshot(): Promise<SnapshotType<SnapshotPayload>> {
        throw new Error('Not implemented')
    }

    async getSnapshot(): Promise<SnapshotPayload> {
        if (this._snapshot && Date.now() <= this._snapshot.expiresAt) {
            return this._snapshot
        }

        const loaded = await this.loadSnapshotFromStore().catch(() => undefined)
        if (loaded && Date.now() <= loaded.expiresAt) {
            this._snapshot = loaded
            return loaded
        }

        const generated = await this.generateSnapshot()
        this._snapshot = generated
        await this.storeSnapshotToStore({ snapshot: generated }).catch(() => undefined)
        return generated
    }

    async streamEvent({ update: _update }: { update: UpdatePayload }): Promise<void> {
        throw new Error('Not implemented')
    }

    async initializeSubscription({ sessionId }: { sessionId: `SESSION#${string}` }): Promise<void> {
        throw new Error('Not implemented')
    }

    protected async loadSnapshotFromStore(): Promise<SnapshotType<SnapshotPayload> | undefined> {
        throw new Error('Not implemented')
    }

    protected async storeSnapshotToStore({ snapshot: _snapshot }: { snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        throw new Error('Not implemented')
    }
}


