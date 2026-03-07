import {
    type EphemeraCacheComponentId,
    type EphemeraCacheMarkState,
    type EphemeraCacheDynamoItem,
} from './baseClasses'
import { queryCacheRecordsForComponent } from './cacheAccess'
import { perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

//
// Mark state normalization and comparison helpers
//

const normalizeMarkState = (markState: EphemeraCacheMarkState): EphemeraCacheMarkState => {
    const deduped = new Map<string, string>()

    for (const entry of markState.markValue) {
        if (!entry || typeof entry.mark !== 'string' || typeof entry.value !== 'string') {
            continue
        }
        const mark = entry.mark.trim()
        const value = entry.value.trim()
        if (!mark || !value) {
            continue
        }
        deduped.set(mark, value)
    }

    const markValue = Array.from(deduped.entries())
        .sort(([markA], [markB]) => {
            if (markA < markB) {
                return -1
            }
            if (markA > markB) {
                return 1
            }
            return 0
        })
        .map(([mark, value]) => ({ mark, value }))

    return { markValue }
}

const markStatesEqual = (
    a: EphemeraCacheMarkState,
    b: EphemeraCacheMarkState
): boolean => {
    const normalizedA = normalizeMarkState(a)
    const normalizedB = normalizeMarkState(b)

    if (normalizedA.markValue.length !== normalizedB.markValue.length) {
        return false
    }

    for (let index = 0; index < normalizedA.markValue.length; index += 1) {
        const entryA = normalizedA.markValue[index]
        const entryB = normalizedB.markValue[index]
        if (entryA.mark !== entryB.mark || entryA.value !== entryB.value) {
            return false
        }
    }

    return true
}

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
    query?: typeof queryCacheRecordsForComponent;
}

export const findExactMatchForComponent = async ({
    componentId,
    proposedMarkState,
    perspective,
    query = queryCacheRecordsForComponent
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

