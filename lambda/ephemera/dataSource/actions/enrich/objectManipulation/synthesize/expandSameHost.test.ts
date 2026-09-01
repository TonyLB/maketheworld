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
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', negate: false },
            getCurrentHost,
            getGraph
        )

        expect(result).toEqual({ verdict: 'satisfied', hostId: ROOM_ID })
    })

    it('repairs "put tray on table": tray held, table in the room --- subject moves to object\'s host', () => {
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) =>
            hostId === CHARACTER_ID ? subjectGraph : undefined

        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', negate: false },
            getCurrentHost,
            getGraph
        )

        expect(result).toEqual({
            verdict: 'repaired',
            hostId: ROOM_ID,
            transferStep: {
                kind: 'transferMembership',
                objectIds: new Set([TRAY_ID]),
                fromHostId: CHARACTER_ID,
                toHostId: ROOM_ID,
            },
        })
    })

    it('repairs "attach charm to necklace": charm in the room, necklace held --- subject moves to object\'s host', () => {
        const subjectGraph = testLudicGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: CHARM_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === CHARM_ID ? ROOM_ID : CHARACTER_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) =>
            hostId === ROOM_ID ? subjectGraph : undefined

        const result = expandSameHost(
            { subjectId: CHARM_ID, objectId: NECKLACE_ID, relationKind: 'On', negate: false },
            getCurrentHost,
            getGraph
        )

        expect(result).toEqual({
            verdict: 'repaired',
            hostId: CHARACTER_ID,
            transferStep: {
                kind: 'transferMembership',
                objectIds: new Set([CHARM_ID]),
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
            },
        })
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
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', negate: false },
            getCurrentHost,
            getGraph
        )

        expect(result).toEqual({ verdict: 'defer', decidable: false, reason: expect.any(String) })
    })

    it('errors when getCurrentHost has no entry for the subject', () => {
        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', negate: false },
            () => undefined,
            () => undefined
        )

        expect(result.verdict).toBe('error')
    })

    it('errors when getCurrentHost has no entry for the object', () => {
        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', negate: false },
            (id: EphemeraObjectId) => (id === TRAY_ID ? ROOM_ID : undefined),
            () => undefined
        )

        expect(result.verdict).toBe('error')
    })

    it('errors when the subject\'s host graph is missing', () => {
        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', negate: false },
            () => ROOM_ID,
            () => undefined
        )

        expect(result.verdict).toBe('error')
    })

    it('treats a negated assertion as satisfied when subject and object do not already share a host (ternary-safe)', () => {
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) =>
            hostId === CHARACTER_ID ? subjectGraph : undefined

        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', negate: true },
            getCurrentHost,
            getGraph
        )

        expect(result).toEqual({ verdict: 'satisfied', hostId: CHARACTER_ID })
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
            { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Custom', negate: false, relationLabel: 'to' },
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

    it('PV1-3: falls back to defer when no crossing boundary is found (no relationLabel supplied, or genuinely no shared ancestor)', () => {
        const subjectGraph = testLudicGraph(CHARACTER_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const getCurrentHost = (id: EphemeraObjectId) => (id === TRAY_ID ? CHARACTER_ID : ROOM_ID)
        const getGraph = (hostId: EphemeraMembershipHostId) => (hostId === CHARACTER_ID ? subjectGraph : undefined)

        const result = expandSameHost(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', negate: false },
            getCurrentHost,
            getGraph,
            () => []
        )

        expect(result).toEqual({ verdict: 'defer', decidable: false, reason: expect.any(String) })
    })

    it('errors on a violated negated assertion (no repair rule for "keep these apart")', () => {
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
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', negate: true },
            getCurrentHost,
            getGraph
        )

        expect(result.verdict).toBe('error')
    })
})
