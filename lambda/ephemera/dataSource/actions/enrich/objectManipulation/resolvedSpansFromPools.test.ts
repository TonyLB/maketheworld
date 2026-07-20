import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { resolvedSpansFromPools } from './resolvedSpansFromPools'
import type { ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'

const BAG_ID = 'OBJECT#Bag' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const BENCH_A_ID = 'OBJECT#BenchA' as EphemeraObjectId
const BENCH_B_ID = 'OBJECT#BenchB' as EphemeraObjectId

const candidate = (id: EphemeraObjectId, jointRelevance = 1): ObjectSpanCandidate => ({
    id,
    label: id,
    jointRelevance,
    sourceTags: ['exact'],
    locus: { kind: 'room' },
})

describe('resolvedSpansFromPools', () => {
    it('maps a single-candidate pool to a resolved verdict keyed by stableRefKey', () => {
        const pool: SpanCandidatePool = { span: 'bag', candidates: [candidate(BAG_ID)] }
        const result = resolvedSpansFromPools(new Map([['bagRef', pool]]))

        expect(result.get('bagRef')).toEqual({ verdict: 'resolved', candidateIds: [BAG_ID] })
    })

    it('prefers shortlist over the full candidate list when both are present', () => {
        const pool: SpanCandidatePool = {
            span: 'bench',
            candidates: [candidate(BENCH_A_ID), candidate(BENCH_B_ID)],
            shortlist: [candidate(BENCH_A_ID)],
        }
        const result = resolvedSpansFromPools(new Map([['benchRef1', pool]]))

        expect(result.get('benchRef1')).toEqual({ verdict: 'resolved', candidateIds: [BENCH_A_ID] })
    })

    it('maps an empty pool to an unresolved verdict with a reason', () => {
        const pool: SpanCandidatePool = { span: 'unicorn', candidates: [] }
        const result = resolvedSpansFromPools(new Map([['unicornRef', pool]]))

        expect(result.get('unicornRef')).toEqual({
            verdict: 'unresolved',
            reason: 'No candidates found for span "unicorn"',
        })
    })

    it('keeps distinct keys independent, including duplicate-span-text pools ("put bench on bench")', () => {
        const pools = new Map<string, SpanCandidatePool>([
            ['benchRef1', { span: 'bench', candidates: [candidate(BENCH_A_ID), candidate(BENCH_B_ID)] }],
            ['benchRef2', { span: 'bench', candidates: [candidate(BENCH_A_ID), candidate(BENCH_B_ID)] }],
            ['tableRef', { span: 'table', candidates: [candidate(TABLE_ID)] }],
        ])
        const result = resolvedSpansFromPools(pools)

        expect(result.size).toBe(3)
        expect(result.get('benchRef1')).toEqual({ verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID] })
        expect(result.get('benchRef2')).toEqual({ verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID] })
        expect(result.get('tableRef')).toEqual({ verdict: 'resolved', candidateIds: [TABLE_ID] })
    })

    it('returns an empty map for an empty pool map', () => {
        expect(resolvedSpansFromPools(new Map()).size).toBe(0)
    })
})
