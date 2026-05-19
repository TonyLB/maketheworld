import {
    DEFAULT_SITUATION_EPHEMERA_ID,
    selectDefaultSituationCacheRecord,
} from './selectDefaultSituationCacheRecord'
import type { EphemeraCacheDynamoItem } from './baseClasses'

const baseRecord = {
    EphemeraId: 'FEATURE#one' as const,
    DataCategory: 'CACHE#a',
    markState: { markValue: [] },
    renderedContent: { description: ['x'] },
    provenance: { type: 'authored' as const },
    perspectiveId: 'PERSPECTIVE#test',
    perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
}

describe('selectDefaultSituationCacheRecord', () => {
    it('returns the row with SITUATION#DEFAULT', () => {
        const defaultRow: EphemeraCacheDynamoItem = {
            ...baseRecord,
            situationId: DEFAULT_SITUATION_EPHEMERA_ID,
        }
        const otherRow: EphemeraCacheDynamoItem = {
            ...baseRecord,
            DataCategory: 'CACHE#b',
            situationId: 'SITUATION#other',
        }
        expect(selectDefaultSituationCacheRecord([otherRow, defaultRow])).toBe(defaultRow)
    })

    it('returns undefined when no DEFAULT row exists', () => {
        const otherRow: EphemeraCacheDynamoItem = {
            ...baseRecord,
            situationId: 'SITUATION#other',
        }
        expect(selectDefaultSituationCacheRecord([otherRow])).toBeUndefined()
    })
})
