import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { testLudicGraph } from '../../../../positions/ludicGraph/testFixtures'
import { expandSameHost } from './expandSameHost'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHARM_ID = 'OBJECT#Charm' as EphemeraObjectId
const NECKLACE_ID = 'OBJECT#Necklace' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('expandSameHost', () => {
    it('is satisfied when subject and object already share a host', () => {
        const graph = testLudicGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [],
        })
        const getCurrentHost = () => ROOM_ID
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === ROOM_ID ? graph : undefined)

        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On' },
            getCurrentHost,
            getGraph
        )

        expect(result).toEqual({ verdict: 'satisfied', hostId: ROOM_ID })
    })

    it('errors rather than relocating anything on a violated hosting kind ("put tray on table", tray held)', () => {
        // PV1-3b-9: this shape used to be the motivating case for `repaired` --- move the tray
        // onto the table's host and call the precondition fixed. A hosting relation is a
        // membership move, not a relational placement, so it gets no branch on this route at
        // all now. Unreachable live (the ingress lane defers `on` per CD2); asserted so that
        // making it reachable is a deliberate act with a branch built for it, not a silent
        // fall-through into peer-relation machinery.
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) =>
            hostId === CHARACTER_ID ? subjectGraph : undefined

        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On' },
            getCurrentHost,
            getGraph
        )

        expect(result.verdict).toBe('error')
        if (result.verdict !== 'error') return
        expect(result.reason).toEqual(expect.stringContaining('On'))
    })

    it('PV1-3b-9: an Under relation crosses the shard boundary, minting a port with no relationLabel', () => {
        const roomGraph = testLudicGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: NECKLACE_ID }, { tag: 'Object', universalKey: TABLE_ID }],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === NECKLACE_ID ? ROOM_ID : TABLE_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === ROOM_ID ? roomGraph : undefined)
        const getMembershipContainers = (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] => {
            if (id === NECKLACE_ID) return [ROOM_ID]
            if (id === CHARM_ID) return [TABLE_ID]
            if (id === TABLE_ID) return [ROOM_ID]
            return []
        }

        const result = expandSameHost(
            { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Under' },
            getCurrentHost,
            getGraph,
            getMembershipContainers
        )

        expect(result.verdict).toBe('crossed')
        if (result.verdict !== 'crossed') return
        const [addPortStep, interiorLeg, exteriorLeg] = result.steps
        expect(addPortStep).toMatchObject({ kind: 'addCrossingPort', hostId: TABLE_ID, port: { fromHostId: ROOM_ID, kind: 'Under' } })
        if (addPortStep.kind !== 'addCrossingPort') return
        // The label is what `Custom` exists to make a place for --- an enum kind carries none,
        // on the port or on either leg.
        expect(addPortStep.port).not.toHaveProperty('exteriorRelationLabel')
        expect(interiorLeg).toMatchObject({ kind: 'establishRelation', targetId: CHARM_ID, relationKind: 'Under' })
        expect(interiorLeg).not.toHaveProperty('relationLabel')
        expect(exteriorLeg).toMatchObject({ kind: 'establishRelation', subjectId: NECKLACE_ID, relationKind: 'Under' })
        expect(exteriorLeg).not.toHaveProperty('relationLabel')
    })

    it('PV1-3b-9: an Against relation crosses the same way --- the gate is on peer-ness, not on one kind', () => {
        const roomGraph = testLudicGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: NECKLACE_ID }, { tag: 'Object', universalKey: TABLE_ID }],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === NECKLACE_ID ? ROOM_ID : TABLE_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === ROOM_ID ? roomGraph : undefined)
        const getMembershipContainers = (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] => {
            if (id === NECKLACE_ID) return [ROOM_ID]
            if (id === CHARM_ID) return [TABLE_ID]
            if (id === TABLE_ID) return [ROOM_ID]
            return []
        }

        const result = expandSameHost(
            { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Against' },
            getCurrentHost,
            getGraph,
            getMembershipContainers
        )

        expect(result.verdict).toBe('crossed')
        if (result.verdict !== 'crossed') return
        expect(result.steps[0]).toMatchObject({ kind: 'addCrossingPort', port: { kind: 'Against' } })
    })

    it('PV1-3b-9: an Under relation with no reachable boundary defers, and not in Custom\'s words', () => {
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === CHARACTER_ID ? subjectGraph : undefined)

        const underResult = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Under' },
            getCurrentHost,
            getGraph,
            () => []
        )
        const customResult = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
            getCurrentHost,
            getGraph,
            () => []
        )

        expect(underResult.verdict).toBe('defer')
        if (underResult.verdict !== 'defer') return
        expect(customResult.verdict).toBe('defer')
        if (customResult.verdict !== 'defer') return
        // Both decline, for different reasons, and the wording has to say which: Custom's defer
        // routes to an LLM validator (BD-10), while this one means the crossing shape is
        // unsupported --- a question no LLM can answer. Sharing wording would misroute it.
        expect(underResult.reason).not.toEqual(customResult.reason)
        expect(underResult.reason).toEqual(expect.stringContaining('Under'))
    })

    it('defers on a Custom relation kind when hosts differ', () => {
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) =>
            hostId === CHARACTER_ID ? subjectGraph : undefined

        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
            getCurrentHost,
            getGraph
        )

        expect(result).toEqual({ verdict: 'defer', decidable: false, reason: expect.any(String) })
    })

    it('errors when getCurrentHost has no entry for the subject', () => {
        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On' },
            () => undefined,
            () => undefined
        )

        expect(result.verdict).toBe('error')
    })

    it('errors when getCurrentHost has no entry for the object', () => {
        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On' },
            (id: EphemeraObjectId) => (id === TRAY_ID ? ROOM_ID : undefined),
            () => undefined
        )

        expect(result.verdict).toBe('error')
    })

    it('errors when the subject\'s host graph is missing', () => {
        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On' },
            () => ROOM_ID,
            () => undefined
        )

        expect(result.verdict).toBe('error')
    })

    it('PV1-3: a violated Custom relation crosses the shard boundary instead of deferring, when one is found', () => {
        const roomGraph = testLudicGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: NECKLACE_ID }, { tag: 'Object', universalKey: TABLE_ID }],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === NECKLACE_ID ? ROOM_ID : TABLE_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === ROOM_ID ? roomGraph : undefined)
        const getMembershipContainers = (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] => {
            if (id === NECKLACE_ID) return [ROOM_ID]
            if (id === CHARM_ID) return [TABLE_ID]
            if (id === TABLE_ID) return [ROOM_ID]
            return []
        }

        const result = expandSameHost(
            { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Custom', relationLabel: 'to' },
            getCurrentHost,
            getGraph,
            getMembershipContainers
        )

        expect(result.verdict).toBe('crossed')
        if (result.verdict !== 'crossed') return
        expect(result.steps).toEqual([
            { kind: 'addCrossingPort', hostId: TABLE_ID, port: expect.objectContaining({ fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }) },
            {
                kind: 'establishRelation',
                subjectId: expect.objectContaining({ owner: TABLE_ID }),
                targetId: CHARM_ID,
                relationKind: 'Custom',
                relationLabel: 'to',
            },
            {
                kind: 'establishRelation',
                subjectId: NECKLACE_ID,
                targetId: expect.objectContaining({ owner: TABLE_ID }),
                relationKind: 'Custom',
                relationLabel: 'to',
            },
        ])
    })

    it('PV1-3: falls back to defer when no crossing boundary is found (genuinely no shared ancestor)', () => {
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === CHARACTER_ID ? subjectGraph : undefined)

        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
            getCurrentHost,
            getGraph,
            () => []
        )

        expect(result).toEqual({ verdict: 'defer', decidable: false, reason: expect.any(String) })
    })

    it('PV1-3b-6: a Custom relation with no relationLabel is malformed input --- errors, and not in the LLM-defer\'s words', () => {
        // The label used to be missing from every live seed, and this shape fell through to the
        // BD-10 defer as though an LLM could resolve it. It cannot: a Custom relation *is* its
        // label, so with none there is no relation to reason about. The two must stay
        // distinguishable in wording, for the same reason PV1-3b-9's pair of defers must be ---
        // the reason string is what routes the follow-up.
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === CHARACTER_ID ? subjectGraph : undefined)

        const unlabelled = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom' },
            getCurrentHost,
            getGraph,
            () => []
        )
        const labelled = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
            getCurrentHost,
            getGraph,
            () => []
        )

        expect(unlabelled.verdict).toBe('error')
        if (unlabelled.verdict !== 'error') return
        expect(labelled.verdict).toBe('defer')
        if (labelled.verdict !== 'defer') return
        expect(unlabelled.reason).toEqual(expect.stringContaining('relationLabel'))
        expect(unlabelled.reason).not.toEqual(labelled.reason)
    })

    it('PV1-3b-6: the malformed-input check precedes every state lookup --- it asks nothing about the world', () => {
        // Asserted rather than left to branch order: with no host and no graph available, a
        // label-less Custom still reports the label problem, not "No current host found". The
        // guard has to survive PV1-3b-4's deletion of the host/graph lookups below it.
        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom' },
            () => undefined,
            () => undefined
        )

        expect(result.verdict).toBe('error')
        if (result.verdict !== 'error') return
        expect(result.reason).toEqual(expect.stringContaining('relationLabel'))
    })
})
