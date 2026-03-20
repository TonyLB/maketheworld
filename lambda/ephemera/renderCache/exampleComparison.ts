import {
    type EphemeraCacheComponentId,
    type EphemeraCacheMarkState,
    type EphemeraCacheDynamoItem,
} from './baseClasses'
import type { QueryCacheRecordsForComponentFn } from './cacheAccess'
import { perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { normalizeMarkState, markStatesEqual } from './markStateUtils'
import internalCache from '../internalCache'

export { normalizeMarkState, markStatesEqual } from './markStateUtils'

export type FindExactMatchInput = {
    componentId: EphemeraCacheComponentId;
    proposedMarkState: EphemeraCacheMarkState;
    records: EphemeraCacheDynamoItem[];
    perspective: Perspective;
}

export const findExactMatch = ({
    proposedMarkState,
    records,
    perspective
}: FindExactMatchInput): EphemeraCacheDynamoItem | null => {
    const normalizedProposed = normalizeMarkState(proposedMarkState)

    const candidates = records.filter((record) => {
        if (!record.perspectiveMatcher) {
            return false
        }
        return perspectiveMatches(record.perspectiveMatcher, perspective)
    })

    for (const record of candidates) {
        if (markStatesEqual(normalizedProposed, record.markState)) {
            return record
        }
    }

    return null
}

export type FindExactMatchForComponentInput = {
    componentId: EphemeraCacheComponentId;
    proposedMarkState: EphemeraCacheMarkState;
    perspective: Perspective;
    query?: QueryCacheRecordsForComponentFn;
}

export const findExactMatchForComponent = async ({
    componentId,
    proposedMarkState,
    perspective,
    query = (id) => internalCache.RenderCache.get(id)
}: FindExactMatchForComponentInput): Promise<EphemeraCacheDynamoItem | null> => {
    const records = await query(componentId)
    return findExactMatch({
        componentId,
        proposedMarkState,
        records,
        perspective
    })
}

export const testing = {
    normalizeMarkState,
    markStatesEqual
}
