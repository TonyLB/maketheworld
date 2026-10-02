import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import type { ExecutorRelationalChain } from './executorTypes'
import { filterLegalRelationalCandidates } from './filterLegalRelationalCandidates'

const HOST_ID = 'ROOM#Bridge' as EphemeraRoomId
const BROOM = 'OBJECT#Broom' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const BENCH = 'OBJECT#Bench' as EphemeraObjectId

const cleanGraph = () =>
    EphemeraLudicGraph.empty(HOST_ID).addObject(BROOM).addObject(TABLE).addObject(BENCH)

// A relation inside one graph is a chain with one leg (AP-6).
const oneLegChain = (
    operationKind: ExecutorRelationalChain['operationKind'],
    from: EphemeraObjectId,
    to: EphemeraObjectId,
    kind: 'Under' | 'Against',
    hostId: EphemeraMembershipHostId = HOST_ID
): ExecutorRelationalChain => ({
    kind: 'relationalChain',
    operationKind,
    steps: [{ type: 'edge', hostId, edge: { from, to, kind } }],
})

const lookupFor = (graph: EphemeraLudicGraph) => ({
    getGraph: (hostId: EphemeraMembershipHostId): EphemeraLudicGraph | undefined =>
        hostId === HOST_ID ? graph : undefined,
})

describe('filterLegalRelationalCandidates', () => {
    // The former "drops a self-relation On candidate via the cycle check" test is retired
    // 2026-08-22 (Channel D, CD2, reduced scope): `On` dropped out of the ingress lane's relation kinds
    // entirely (it can no longer be constructed as an ingress-lane step), so `Under` below is now
    // the only case exercising this cycle check -- `On`'s half of the `'On' | 'Under'` guard in
    // `filterLegalRelationalCandidates.ts` is unreachable, not merely untested.

    it('drops a self-relation Under candidate via the cycle check', () => {
        const candidate = oneLegChain('establishRelation', BROOM, BROOM, 'Under')
        expect(filterLegalRelationalCandidates([candidate], lookupFor(cleanGraph()))).toEqual({
            ok: false,
            reason: expect.any(String),
        })
    })

    it('does not drop a self-relation Against candidate (cycle check out of scope for Against)', () => {
        const candidate = oneLegChain('establishRelation', BROOM, BROOM, 'Against')
        expect(filterLegalRelationalCandidates([candidate], lookupFor(cleanGraph()))).toEqual({
            ok: true,
            candidates: [candidate],
        })
    })

    it('keeps the legal candidate and drops the self-relation one from a mixed pool', () => {
        const selfRelation = oneLegChain('establishRelation', BROOM, BROOM, 'Under')
        const legal = oneLegChain('establishRelation', BROOM, TABLE, 'Under')
        expect(
            filterLegalRelationalCandidates([selfRelation, legal], lookupFor(cleanGraph()))
        ).toEqual({ ok: true, candidates: [legal] })
    })

    it('still applies evaluateRelationalLegality complexRelational before the cycle check', () => {
        const graphWithExistingEdge = cleanGraph().addRelationalEdge({
            from: BROOM,
            to: TABLE,
            kind: 'Under',
        })
        const conflicting = oneLegChain('establishRelation', BROOM, TABLE, 'Against')
        expect(
            filterLegalRelationalCandidates([conflicting], lookupFor(graphWithExistingEdge))
        ).toEqual({ ok: false, reason: expect.any(String) })
    })

    it('drops a dissolveRelation candidate with no matching edge', () => {
        const candidate = oneLegChain('dissolveRelation', BROOM, TABLE, 'Under')
        expect(filterLegalRelationalCandidates([candidate], lookupFor(cleanGraph()))).toEqual({
            ok: false,
            reason: expect.any(String),
        })
    })

    it('returns ok:false when every candidate in a non-empty pool is illegal', () => {
        const graphWithExistingEdge = cleanGraph().addRelationalEdge({
            from: BROOM,
            to: TABLE,
            kind: 'Under',
        })
        const selfRelation = oneLegChain('establishRelation', BENCH, BENCH, 'Under')
        const conflicting = oneLegChain('establishRelation', BROOM, TABLE, 'Against')
        expect(
            filterLegalRelationalCandidates([selfRelation, conflicting], lookupFor(graphWithExistingEdge))
        ).toEqual({ ok: false, reason: expect.any(String) })
    })

    it('passes a crossing (a chain with more than one leg) unchecked, as before --- chain validation is slice 2c', () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: HOST_ID, kind: 'Under' }
        const crossing: ExecutorRelationalChain = {
            kind: 'relationalChain',
            operationKind: 'establishRelation',
            steps: [
                { type: 'port', hostId: TABLE, port },
                { type: 'edge', hostId: TABLE, edge: { from: { owner: TABLE, port: 'port-1' }, to: BENCH, kind: 'Under' } },
                { type: 'edge', hostId: HOST_ID, edge: { from: BROOM, to: { owner: TABLE, port: 'port-1' }, kind: 'Under' } },
            ],
        }
        expect(
            filterLegalRelationalCandidates([crossing], { getGraph: () => undefined })
        ).toEqual({ ok: true, candidates: [crossing] })
    })

    it('drops a candidate whose leg host has no graph in the lookup, leaving siblings unaffected', () => {
        const noGraphHost = 'ROOM#Unknown' as EphemeraRoomId
        const missingGraphCandidate = oneLegChain('establishRelation', BROOM, TABLE, 'Under', noGraphHost)
        const legalCandidate = oneLegChain('establishRelation', BROOM, TABLE, 'Under')
        expect(
            filterLegalRelationalCandidates(
                [missingGraphCandidate, legalCandidate],
                lookupFor(cleanGraph())
            )
        ).toEqual({ ok: true, candidates: [legalCandidate] })
    })

    it('keeps an all-legal, no-cycle pool intact and in order', () => {
        const first = oneLegChain('establishRelation', BROOM, TABLE, 'Under')
        const second = oneLegChain('establishRelation', BENCH, TABLE, 'Under')
        expect(
            filterLegalRelationalCandidates([first, second], lookupFor(cleanGraph()))
        ).toEqual({ ok: true, candidates: [first, second] })
    })
})
