/**
 * Request-scoped memo of render-cache Dynamo rows per component (`queryCacheRecordsForComponent`).
 * Mutate via `set` only after `get` has loaded that component; otherwise `set` is a no-op.
 */
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCacheComponentId, EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'
import type { EphemeraCacheMarkState } from '../dataSource/renderCache/baseClasses'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
} from '../dataSource/renderCache/baseClasses'
import type { PutCacheRecordInput } from '../dataSource/renderCache/putCacheRecord'
import type { QueryCacheRecordsForComponentFn } from '../dataSource/renderCache/queryCacheRecordsForComponent'
import { perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { markStatesEqual } from '../renderCache/markStateUtils'

/** Fields to upsert into the in-memory array (after `get` has run for `componentId`). */
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

export class RenderCacheData {
    private readonly rowsByComponent = new Map<EphemeraCacheComponentId, EphemeraCacheDynamoItem[]>()
    private readonly query: QueryCacheRecordsForComponentFn

    constructor(queryCacheRecordsForComponent: QueryCacheRecordsForComponentFn) {
        this.query = queryCacheRecordsForComponent
    }

    /**
     * Returns the same array reference for a given `componentId` within an invocation so `set` can upsert in place.
     */
    async get(componentId: EphemeraCacheComponentId): Promise<EphemeraCacheDynamoItem[]> {
        const hit = this.rowsByComponent.get(componentId)
        if (hit !== undefined) {
            return hit
        }
        const rows = await this.query(componentId)
        this.rowsByComponent.set(componentId, rows)
        return rows
    }

    /**
     * No-op if `get` has never been called for `componentId`.
     * Invalid `cacheId` (present but not `CACHE#...`) is a no-op.
     */
    set(params: RenderCacheSetParams): void {
        const { componentId, markState, cacheId, renderedContent, provenance, perspectiveId, perspectiveMatcher } = params
        const rows = this.rowsByComponent.get(componentId)
        if (rows === undefined) {
            return
        }
        if (cacheId !== undefined && !cacheId.startsWith(EPHEMERA_CACHE_DATA_CATEGORY_PREFIX)) {
            return
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
     * No-op unless `get(componentId)` has already populated the memo.
     *
     * Important: this mutates the existing array in-place so any callers holding
     * the memo reference observe the updated contents.
     */
    deleteCacheRecords(componentId: EphemeraCacheComponentId, cacheIds: string[]): void {
        const rows = this.rowsByComponent.get(componentId)
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
        this.rowsByComponent.clear()
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
