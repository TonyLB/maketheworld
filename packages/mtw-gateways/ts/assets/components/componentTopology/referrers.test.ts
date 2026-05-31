import type { PersistedReferencedByEntry } from '../componentData/referencedBy'

import { filterAreaEdgeReferrers } from './referrers'

describe('filterAreaEdgeReferrers', () => {
    it('keeps AREA# referrers with Edge referenceType', () => {
        const entries: PersistedReferencedByEntry[] = [
            { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
            { referrerUniversalKey: 'FEATURE#gate', referenceType: 'Direct' },
        ]
        expect(filterAreaEdgeReferrers(entries)).toEqual(['AREA#region'])
    })

    it('drops non-Edge reference types on AREA# referrers', () => {
        const entries: PersistedReferencedByEntry[] = [
            { referrerUniversalKey: 'AREA#region', referenceType: 'Direct' },
        ]
        expect(filterAreaEdgeReferrers(entries)).toEqual([])
    })

    it('dedupes duplicate AREA# referrers', () => {
        const entries: PersistedReferencedByEntry[] = [
            { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
            { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
        ]
        expect(filterAreaEdgeReferrers(entries)).toEqual(['AREA#region'])
    })
})
