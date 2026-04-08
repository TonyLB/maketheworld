/**
 * Request-scoped memo of render-cache Dynamo rows per component (`queryCacheRecordsForComponent`).
 * Uses DeferredCache for read-through loading and concurrent get dedupe; `set` is authoritative
 * (may initialize state before the first `get` for that component).
 */
import { v4 as uuidv4 } from 'uuid'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraCacheComponentId, EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'
import type { EphemeraCacheMarkState } from '../dataSource/renderCache/baseClasses'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
} from '../dataSource/renderCache/baseClasses'
import type { PutCacheRecordInput } from '../dataSource/renderCache/putCacheRecord'
import type { QueryCacheRecordsForComponentFn } from '../dataSource/renderCache/queryCacheRecordsForComponent'
import { perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { markStatesEqual } from '../dataSource/renderCache/utils/markState'

/** Fields to upsert into the in-memory array for `componentId`. */
export type RenderCacheSetParams = {
    componentId: EphemeraCacheComponentId;
    markState: PutCacheRecordInput['markState'];
    /** Dynamo DataCategory (`CACHE#...`). If omitted, match by `markState` or append with a new key. */
    cacheId?: string;
    renderedContent: PutCacheRecordInput['renderedContent'];
    provenance: PutCacheRecordInput['provenance'];
    perspectiveId: PutCacheRecordInput['perspectiveId'];
    perspectiveMatcher: PutCacheRecordInput['perspectiveMatcher'];
    situationId?: PutCacheRecordInput['situationId'];
    authoredExampleId?: PutCacheRecordInput['authoredExampleId'];
}

const cacheKey = (componentId: EphemeraCacheComponentId): string => componentId as string

export class RenderCacheData {
    private readonly _Cache: DeferredCache<EphemeraCacheDynamoItem[]>
    private _Store: Record<string, EphemeraCacheDynamoItem[]> = {}
    private readonly query: QueryCacheRecordsForComponentFn

    constructor(queryCacheRecordsForComponent: QueryCacheRecordsForComponentFn) {
        this.query = queryCacheRecordsForComponent
        this._Cache = new DeferredCache<EphemeraCacheDynamoItem[]>({
            callback: (key, value) => {
                this._Store[key] = value
            },
        })
    }

    /**
     * Returns the same array reference for a given `componentId` within an invocation so `set` can upsert in place.
     */
    async get(componentId: EphemeraCacheComponentId): Promise<EphemeraCacheDynamoItem[]> {
        const key = cacheKey(componentId)
        if (!this._Cache.isCached(key)) {
            this._Cache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, EphemeraCacheDynamoItem[]> = {}
                    await Promise.all(
                        keys.map(async (k) => {
                            out[k] = await this.query(k as EphemeraCacheComponentId)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._Cache.get(key)
        return this._Store[key]
    }

    /**
     * Authoritative upsert: initializes cache state for `componentId` when needed.
     * Invalid `cacheId` (present but not `CACHE#...`) is a no-op.
     */
    set(params: RenderCacheSetParams): void {
        const { componentId, markState, cacheId, renderedContent, provenance, perspectiveId, perspectiveMatcher } = params
        const key = cacheKey(componentId)

        if (cacheId !== undefined && !cacheId.startsWith(EPHEMERA_CACHE_DATA_CATEGORY_PREFIX)) {
            return
        }

        let rows = this._Store[key]
        if (rows === undefined) {
            rows = []
            this._Cache.set(Infinity, key, rows)
            this._Store[key] = rows
        }

        const baseItem = {
            EphemeraId: componentId,
            markState,
            renderedContent,
            provenance,
            perspectiveId,
            perspectiveMatcher,
            ...(params.situationId !== undefined ? { situationId: params.situationId } : {}),
            ...(params.authoredExampleId !== undefined ? { authoredExampleId: params.authoredExampleId } : {}),
        } satisfies Omit<EphemeraCacheDynamoItem, 'DataCategory'>

        if (cacheId !== undefined) {
            const index = rows.findIndex((r) => r.DataCategory === cacheId)
            const item: EphemeraCacheDynamoItem = { ...baseItem, DataCategory: cacheId }
            if (index >= 0) {
                rows[index] = item
            } else {
                rows.push(item)
            }
            return
        }

        const index = rows.findIndex((r) => markStatesEqual(r.markState, markState))
        const dataCategory =
            index >= 0
                ? rows[index].DataCategory
                : `${EPHEMERA_CACHE_DATA_CATEGORY_PREFIX}${uuidv4()}`
        const item: EphemeraCacheDynamoItem = { ...baseItem, DataCategory: dataCategory }
        if (index >= 0) {
            rows[index] = item
        } else {
            rows.push(item)
        }
    }

    /**
     * Remove specific memo rows from the invocation-scoped cache.
     * No-op unless `get(componentId)` or `set` has populated rows for that component.
     *
     * Important: this mutates the existing array in-place so any callers holding
     * the memo reference observe the updated contents.
     */
    deleteCacheRecords(componentId: EphemeraCacheComponentId, cacheIds: string[]): void {
        const rows = this._Store[cacheKey(componentId)]
        if (rows === undefined) {
            return
        }

        if (!cacheIds.length) {
            return
        }

        const idSet = new Set(cacheIds)
        const next = rows.filter((r) => !idSet.has(r.DataCategory))
        if (next.length === rows.length) {
            return
        }
        rows.splice(0, rows.length, ...next)
    }

    clear(): void {
        this._Cache.clear()
        this._Store = {}
    }

    invalidate(componentId: EphemeraCacheComponentId): void {
        const key = cacheKey(componentId)
        delete this._Store[key]
        this._Cache.invalidate(key)
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    /**
     * Component-scoped exact-match lookup:
     * - memoized Dynamo rows via `get(componentId)`
     * - filter candidates by matcher-based perspective rules
     * - match by Mark-state equality semantics
     */
    async getExactMatch(params: RenderCacheGetExactMatchParams): Promise<EphemeraCacheDynamoItem | null> {
        const { componentId, proposedMarkState, perspective } = params
        const rows = await this.get(componentId)
        return (
            rows
                // First narrow to perspective-compatible records.
                .filter((record) => record.perspectiveMatcher && perspectiveMatches(record.perspectiveMatcher, perspective))
                // Then narrow to exact mark-state matches.
                .filter((record) => markStatesEqual(proposedMarkState, record.markState))[0] ?? null
        )
    }
}

export type RenderCacheGetExactMatchParams = {
    componentId: EphemeraCacheComponentId;
    proposedMarkState: EphemeraCacheMarkState;
    perspective: Perspective;
}
