import type { ObjectSpanCandidate } from '../spanResolution'

import { gapTrimShortlist } from './gapTrimShortlist'

const candidate = (jointRelevance: number, id = `OBJECT#${jointRelevance}`): ObjectSpanCandidate => ({
    id: id as ObjectSpanCandidate['id'],
    label: `label-${jointRelevance}`,
    jointRelevance,
    sourceTags: ['embedding'],
    locus: { kind: 'room' },
})

describe('gapTrimShortlist', () => {
    it('returns empty for empty input', () => {
        expect(gapTrimShortlist([])).toEqual([])
    })

    it('returns single candidate when clear winner has large gap after top-1', () => {
        const ranked = [candidate(0.9), candidate(0.5), candidate(0.1)]
        expect(gapTrimShortlist(ranked, {}, { relativeDrop: 0.15 })).toHaveLength(1)
    })

    it('includes bunched top scores until gap or ceiling', () => {
        const ranked = [
            candidate(0.5),
            candidate(0.48),
            candidate(0.47),
            candidate(0.1),
        ]
        const shortlist = gapTrimShortlist(ranked, {}, { relativeDrop: 0.15, topN: 5 })
        expect(shortlist).toHaveLength(3)
    })

    it('stops at Top-N ceiling when no gap appears', () => {
        const ranked = Array.from({ length: 8 }, (_, index) => candidate(0.5 - index * 0.01))
        const shortlist = gapTrimShortlist(ranked, {}, { relativeDrop: 0.5, topN: 3 })
        expect(shortlist).toHaveLength(3)
    })

    it('always includes at least the head candidate', () => {
        expect(gapTrimShortlist([candidate(0)])).toHaveLength(1)
    })
})
