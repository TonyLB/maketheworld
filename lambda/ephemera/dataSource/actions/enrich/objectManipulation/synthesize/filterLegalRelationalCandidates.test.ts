import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import type { ParsePlanStep } from '../parsePlanStep'
import { filterLegalRelationalCandidates } from './filterLegalRelationalCandidates'

const HOST_ID = 'ROOM#Bridge' as EphemeraRoomId
const BROOM = 'OBJECT#Broom' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const BENCH = 'OBJECT#Bench' as EphemeraObjectId

const cleanGraph = () =>
    EphemeraLudicGraph.empty(HOST_ID).addObject(BROOM).addObject(TABLE).addObject(BENCH)

const lookupFor = (graph: EphemeraLudicGraph) => ({
    getGraph: (hostId: EphemeraMembershipHostId): EphemeraLudicGraph | undefined =>
        hostId === HOST_ID ? graph : undefined,
})

describe('filterLegalRelationalCandidates', () => {
    it('drops a self-relation On candidate via the cycle check', () => {
        const candidate: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: BROOM,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        expect(filterLegalRelationalCandidates([candidate], lookupFor(cleanGraph()))).toEqual({
            ok: false,
            reason: expect.any(String),
        })
    })

    it('drops a self-relation Under candidate via the cycle check', () => {
        const candidate: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: BROOM,
            relationKind: 'Under',
            hostRoomId: HOST_ID,
        }
        expect(filterLegalRelationalCandidates([candidate], lookupFor(cleanGraph()))).toEqual({
            ok: false,
            reason: expect.any(String),
        })
    })

    it('does not drop a self-relation Against candidate (cycle check out of scope for Against)', () => {
        const candidate: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: BROOM,
            relationKind: 'Against',
            hostRoomId: HOST_ID,
        }
        expect(filterLegalRelationalCandidates([candidate], lookupFor(cleanGraph()))).toEqual({
            ok: true,
            candidates: [candidate],
        })
    })

    it('keeps the legal candidate and drops the self-relation one from a mixed pool', () => {
        const selfRelation: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: BROOM,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        const legal: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: TABLE,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        expect(
            filterLegalRelationalCandidates([selfRelation, legal], lookupFor(cleanGraph()))
        ).toEqual({ ok: true, candidates: [legal] })
    })

    it('still applies evaluateRelationalLegality complexRelational before the cycle check', () => {
        const graphWithExistingEdge = cleanGraph().addRelationalEdge({
            from: BROOM,
            to: TABLE,
            kind: 'On',
        })
        const conflicting: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: TABLE,
            relationKind: 'Under',
            hostRoomId: HOST_ID,
        }
        expect(
            filterLegalRelationalCandidates([conflicting], lookupFor(graphWithExistingEdge))
        ).toEqual({ ok: false, reason: expect.any(String) })
    })

    it('drops a dissolveRelation candidate with no matching edge', () => {
        const candidate: ParsePlanStep = {
            kind: 'dissolveRelation',
            subjectId: BROOM,
            targetId: TABLE,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        expect(filterLegalRelationalCandidates([candidate], lookupFor(cleanGraph()))).toEqual({
            ok: false,
            reason: expect.any(String),
        })
    })

    it('returns ok:false when every candidate in a non-empty pool is illegal', () => {
        const graphWithExistingEdge = cleanGraph().addRelationalEdge({
            from: BROOM,
            to: TABLE,
            kind: 'On',
        })
        const selfRelation: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BENCH,
            targetId: BENCH,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        const conflicting: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: TABLE,
            relationKind: 'Under',
            hostRoomId: HOST_ID,
        }
        expect(
            filterLegalRelationalCandidates([selfRelation, conflicting], lookupFor(graphWithExistingEdge))
        ).toEqual({ ok: false, reason: expect.any(String) })
    })

    it('passes transferMembership candidates through unchanged', () => {
        const candidate: ParsePlanStep = {
            kind: 'transferMembership',
            objectIds: new Set([BROOM]),
            fromHostId: HOST_ID,
            toHostId: HOST_ID,
        }
        expect(
            filterLegalRelationalCandidates([candidate], { getGraph: () => undefined })
        ).toEqual({ ok: true, candidates: [candidate] })
    })

    it('drops a candidate whose hostRoomId has no graph in the lookup, leaving siblings unaffected', () => {
        const noGraphHost = 'ROOM#Unknown' as EphemeraRoomId
        const missingGraphCandidate: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: TABLE,
            relationKind: 'On',
            hostRoomId: noGraphHost,
        }
        const legalCandidate: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: TABLE,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        expect(
            filterLegalRelationalCandidates(
                [missingGraphCandidate, legalCandidate],
                lookupFor(cleanGraph())
            )
        ).toEqual({ ok: true, candidates: [legalCandidate] })
    })

    it('keeps an all-legal, no-cycle pool intact and in order', () => {
        const first: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BROOM,
            targetId: TABLE,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        const second: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: BENCH,
            targetId: TABLE,
            relationKind: 'On',
            hostRoomId: HOST_ID,
        }
        expect(
            filterLegalRelationalCandidates([first, second], lookupFor(cleanGraph()))
        ).toEqual({ ok: true, candidates: [first, second] })
    })
})
