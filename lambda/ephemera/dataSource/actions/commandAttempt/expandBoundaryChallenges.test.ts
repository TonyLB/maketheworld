import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { EphemeraLudicGraph } from '../../positions/ludicGraph'
import { testLudicGraph, testLudicGraphFromEnvelope } from '../../positions/ludicGraph/testFixtures'
import { attemptActionsFromBoundaryOutcomes, attemptActionsFromTransfer } from './expandBoundaryChallenges'
import { PositionAttemptAction } from './action'
import { graphNodeRef } from '../enrich/objectManipulation/plan/planStep'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const ropeId = 'OBJECT#Rope' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const postId = 'OBJECT#Post' as EphemeraObjectId
/** Every relation in these fixtures stays inside the one graph passed, so no other shard is reachable. */
const noShards = () => undefined

describe('attemptActionsFromBoundaryOutcomes', () => {
    it('expands a boundary edge to a non-Object (Character) endpoint too', () => {
        const companionId = 'CHARACTER#Companion' as EphemeraCharacterId
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Character' as const, universalKey: companionId },
            ],
            edges: [{ tag: 'Relational', from: ropeId, to: companionId, kind: 'Custom', relationLabel: 'against' }],
        })
        const primaryAction = new PositionAttemptAction('action-1', [], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, graph, noShards).actions

        expect(actions).toHaveLength(2)
        expect(actions[0]?.desiredResult).toEqual(expect.objectContaining({
            primitive: 'dissolveRelation',
            subject: graphNodeRef(ropeId, [roomId]),
            target: graphNodeRef(companionId, [roomId]),
        }))
    })

    it('adds one action carrying a CustomEdgeChallenge (with the real edge) for a defer-classified boundary edge', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
            ],
            edges: [{ tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' }],
        })
        const primaryAction = new PositionAttemptAction('action-2', [], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, graph, noShards).actions

        expect(actions).toHaveLength(2)
        const dissolveAction = actions[0]
        const challenges = dissolveAction?.challenges() ?? []
        expect(challenges).toHaveLength(1)
        expect(challenges[0]?.detectionSource).toBe('graph')
        expect(challenges[0]?.toJSON()).toEqual(expect.objectContaining({
            edge: { from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' },
        }))
        expect(challenges[0]?.describe()).toContain('is lashed to')
    })

    it('grounds each dissolve in the edge\'s own direction, even when the moved object is the edge\'s target', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
            ],
            edges: [{ tag: 'Relational', from: postId, to: ropeId, kind: 'Custom', relationLabel: 'is lashed to' }],
        })
        const primaryAction = new PositionAttemptAction('action-3', [], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, graph, noShards).actions

        expect((actions[0]?.toJSON() as any).desiredResult).toEqual({
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: graphNodeRef(postId, [roomId]),
            target: graphNodeRef(ropeId, [roomId]),
            relationKind: 'Custom',
            relationLabel: 'is lashed to',
        })
    })

    it('mints a distinct id for each dissolve and keeps the primary action\'s id', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
                { tag: 'Object' as const, universalKey: anvilId },
            ],
            edges: [
                { tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' },
                { tag: 'Relational', from: ropeId, to: anvilId, kind: 'Custom', relationLabel: 'is tied to' },
            ],
        })
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        const ids = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, graph, noShards).actions.map((action) => action.id)

        expect(ids).toHaveLength(3)
        expect(ids[2]).toBe('primary')
        expect(new Set(ids).size).toBe(3)
    })

    it('returns only the primary action when the graph has no boundary edges', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: ropeId }],
        })
        const primaryAction = new PositionAttemptAction('action-4', [], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, graph, noShards).actions

        expect(actions).toEqual([primaryAction])
    })
})

describe('attemptActionsFromBoundaryOutcomes: the narration units Expansion authors', () => {
    const lashedGraph = (from: EphemeraObjectId, to: EphemeraObjectId) => testLudicGraph(roomId, {
        nodes: [
            { tag: 'Object' as const, universalKey: ropeId },
            { tag: 'Object' as const, universalKey: postId },
        ],
        edges: [{ tag: 'Relational', from, to, kind: 'Custom', relationLabel: 'is lashed to' }],
    })
    const freesRopeFromPost = [
        { slot: 'actor' },
        { text: ' frees ' },
        { ref: `graphNode:${ropeId}` },
        { text: ' from ' },
        { ref: `graphNode:${postId}` },
    ]

    it('authors one unit per dissolve, covering it, worded from the moved end, with one audience over both ends before the dissolve', () => {
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        const { actions, narrationUnits } = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, lashedGraph(ropeId, postId), noShards)

        expect(narrationUnits).toEqual([{
            covers: [actions[0]!.id],
            variants: [{
                audience: { refs: [`graphNode:${ropeId}`, `graphNode:${postId}`], phase: 'before' },
                parts: freesRopeFromPost,
            }],
        }])
    })

    it('words the line from the moved end even when the moved object is the edge\'s target', () => {
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        const { narrationUnits } = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, lashedGraph(postId, ropeId), noShards)

        expect(narrationUnits[0]?.variants[0]?.parts).toEqual(freesRopeFromPost)
        expect(narrationUnits[0]?.variants[0]?.audience.refs).toEqual([`graphNode:${ropeId}`, `graphNode:${postId}`])
    })

    it('authors one unit per dissolve when several boundary edges are expanded, in action order', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
                { tag: 'Object' as const, universalKey: anvilId },
            ],
            edges: [
                { tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' },
                { tag: 'Relational', from: ropeId, to: anvilId, kind: 'Custom', relationLabel: 'is tied to' },
            ],
        })
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        const { actions, narrationUnits } = attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, graph, noShards)

        expect(narrationUnits.map(({ covers }) => covers)).toEqual([[actions[0]!.id], [actions[1]!.id]])
    })

    it('authors nothing when there is nothing to dissolve (the primary action is not Expansion\'s)', () => {
        const graph = testLudicGraph(roomId, { nodes: [{ tag: 'Object' as const, universalKey: ropeId }] })
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        expect(attemptActionsFromBoundaryOutcomes(primaryAction, ropeId, graph, noShards).narrationUnits).toEqual([])
    })
})

describe('attemptActionsFromTransfer', () => {
    it('keeps the primary action\'s id when it adds an exit-edge challenge', () => {
        const graph = testLudicGraphFromEnvelope(roomId, {
            nodes: [],
            edges: [{ kind: 'Navigation', uuid: 'edge-1', from: ropeId, to: postId, payload: {} }],
        })
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        const [primary] = attemptActionsFromTransfer(primaryAction, ropeId, graph, noShards).actions

        expect(primary?.challenges().map((challenge) => challenge.toJSON().kind)).toEqual(['exitEdge'])
        expect(primary?.id).toBe('primary')
    })

    describe('presence on the dissolves\' referents', () => {
        const boardId = 'OBJECT#Breadboard' as EphemeraObjectId
        const wireId = 'OBJECT#Wire' as EphemeraObjectId
        const spotId = 'OBJECT#Spot' as EphemeraObjectId
        const westHalf = 'PRESENCE#board-in-west' as EphemeraPresenceNodeId
        const eastHalf = 'PRESENCE#board-in-east' as EphemeraPresenceNodeId
        /** Both ends sit in the board's graph, so each bucket is one of the board's own bindings. */
        const onBoard = (presence: EphemeraPresenceNodeId) => ({ host: boardId, presence })
        const boardGraph = (bindings: { key: EphemeraPresenceNodeId, members?: EphemeraObjectId[] }[]) => testLudicGraph(boardId, {
            nodes: [
                { tag: 'Object' as const, universalKey: boardId },
                { tag: 'Object' as const, universalKey: wireId },
                { tag: 'Object' as const, universalKey: spotId },
                ...bindings.map(({ key, members }) => ({
                    tag: 'Presence' as const,
                    universalKey: key,
                    fromHostId: roomId,
                    cover: members === undefined
                        ? { tag: 'Full' as const }
                        : { tag: 'Enumerated' as const, members: members.map((host) => ({ host, presence: `PRESENCE#${host}-on-board` as EphemeraPresenceNodeId })) },
                })),
            ],
            edges: [{ tag: 'Relational', from: wireId, to: spotId, kind: 'Custom', relationLabel: 'is plugged into' }],
        })
        const takeWire = new PositionAttemptAction('primary', [], undefined, 'Take: wire')

        it('gives both ends every bucket of the host that holds them', () => {
            const [dissolve] = attemptActionsFromTransfer(takeWire, wireId, boardGraph([{ key: westHalf }, { key: eastHalf }]), noShards).actions

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: graphNodeRef(wireId, [onBoard(westHalf), onBoard(eastHalf)]),
                target: graphNodeRef(spotId, [onBoard(westHalf), onBoard(eastHalf)]),
            }))
        })

        // A straddling whole partitions its contents: the wire is in the west half, the spot it is
        // plugged into is in the east half, so unplugging it reaches both halves' rooms.
        it('gives each end its own bucket when an Enumerated split puts them in different ones', () => {
            const [dissolve] = attemptActionsFromTransfer(takeWire, wireId, boardGraph([
                { key: westHalf, members: [wireId] },
                { key: eastHalf, members: [spotId] },
            ]), noShards).actions

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: graphNodeRef(wireId, [onBoard(westHalf)]),
                target: graphNodeRef(spotId, [onBoard(eastHalf)]),
            }))
        })

        it('leaves both ends unlearned when the host is not a room and has no binding', () => {
            const [dissolve] = attemptActionsFromTransfer(takeWire, wireId, boardGraph([]), noShards).actions

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: { referentType: 'graphNode', groundedId: wireId },
                target: { referentType: 'graphNode', groundedId: spotId },
            }))
        })
    })
})

/**
 * A crossing: the string sits in the room, the cup on the table, and the relation between them
 * crosses the table's shard boundary through a port. Each graph holds one leg: the room holds
 * `string -> {table, port}`, the table holds the port and `{table, port} -> cup`.
 */
describe('attemptActionsFromTransfer: a crossing relation', () => {
    const tableId = 'OBJECT#Table' as EphemeraObjectId
    const stringId = 'OBJECT#String' as EphemeraObjectId
    const cupId = 'OBJECT#Cup' as EphemeraObjectId
    const tableBinding = 'PRESENCE#table-in-bridge' as EphemeraPresenceNodeId
    const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'is tied to' }
    const portAddress = { owner: tableId, port: 'port-1' }
    const roomGraph = EphemeraLudicGraph.empty(roomId)
        .addObject(stringId)
        .addObject(tableId)
        .addRelationalEdge({ from: stringId, to: portAddress, kind: 'Custom', relationLabel: 'is tied to' })
    const tableGraph = EphemeraLudicGraph.empty(tableId)
        .addObject(cupId)
        .addPort(port)
        .addPresenceNode({ tag: 'Presence', universalKey: tableBinding, fromHostId: roomId, cover: { tag: 'Full' } })
        .addRelationalEdge({ from: portAddress, to: cupId, kind: 'Custom', relationLabel: 'is tied to' })
    const shards = (hostId: EphemeraMembershipHostId) => ({ [roomId]: roomGraph, [tableId]: tableGraph } as Record<string, EphemeraLudicGraph>)[hostId]
    /** The cup is seen through the table's binding, which lives on the table's graph. */
    const onTable = { host: tableId, presence: tableBinding }

    it('dissolves the relation between its two true ends when the moved end is the relation\'s target, stamping the far end from its own shard', () => {
        const { actions, narrationUnits } = attemptActionsFromTransfer(new PositionAttemptAction('primary', [], undefined, 'Take: cup'), cupId, tableGraph, shards)

        expect(actions).toHaveLength(2)
        expect(actions[0]?.desiredResult).toEqual({
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: graphNodeRef(stringId, [roomId]),
            target: graphNodeRef(cupId, [onTable]),
            relationKind: 'Custom',
            relationLabel: 'is tied to',
        })
        // The challenge judges the leg the move actually severs: the one in the cup's own shard.
        expect(actions[0]?.challenges()[0]?.toJSON()).toEqual(expect.objectContaining({
            edge: { from: portAddress, to: cupId, kind: 'Custom', relationLabel: 'is tied to' },
        }))
        expect(narrationUnits[0]?.variants[0]?.parts).toEqual([
            { slot: 'actor' }, { text: ' frees ' }, { ref: `graphNode:${cupId}` }, { text: ' from ' }, { ref: `graphNode:${stringId}` },
        ])
    })

    it('stamps the far end from the shard holding its own leg, not the moved end\'s graph', () => {
        // Read from the room's graph, the cup would be stamped with the room: the table's
        // binding is what can lead elsewhere.
        const [dissolve] = attemptActionsFromTransfer(new PositionAttemptAction('primary', [], undefined, 'Take: string'), stringId, roomGraph, shards).actions

        expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
            subject: graphNodeRef(stringId, [roomId]),
            target: graphNodeRef(cupId, [onTable]),
        }))
    })

    it('adds no dissolve when the far shard cannot be read: the move\'s commit then refuses it as uncovered', () => {
        const primary = new PositionAttemptAction('primary', [], undefined, 'Take: string')

        const { actions, narrationUnits } = attemptActionsFromTransfer(primary, stringId, roomGraph, noShards)

        expect(actions).toEqual([primary])
        expect(narrationUnits).toEqual([])
    })
})
