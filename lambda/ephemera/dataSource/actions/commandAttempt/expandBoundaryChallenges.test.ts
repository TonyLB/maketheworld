import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testLudicGraph, testLudicGraphFromEnvelope } from '../../positions/ludicGraph/testFixtures'
import { attemptActionsFromBoundaryOutcomes, attemptActionsFromTransfer } from './expandBoundaryChallenges'
import { PositionAttemptAction } from './action'
import { graphNodeRef } from '../enrich/objectManipulation/plan/planStep'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const ropeId = 'OBJECT#Rope' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const postId = 'OBJECT#Post' as EphemeraObjectId

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

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph).actions

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

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph).actions

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

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph).actions

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

        const ids = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph).actions.map((action) => action.id)

        expect(ids).toHaveLength(3)
        expect(ids[2]).toBe('primary')
        expect(new Set(ids).size).toBe(3)
    })

    it('returns only the primary action when the graph has no boundary edges', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: ropeId }],
        })
        const primaryAction = new PositionAttemptAction('action-4', [], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph).actions

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

        const { actions, narrationUnits } = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), lashedGraph(ropeId, postId))

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

        const { narrationUnits } = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), lashedGraph(postId, ropeId))

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

        const { actions, narrationUnits } = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect(narrationUnits.map(({ covers }) => covers)).toEqual([[actions[0]!.id], [actions[1]!.id]])
    })

    it('authors nothing when there is nothing to dissolve (the primary action is not Expansion\'s)', () => {
        const graph = testLudicGraph(roomId, { nodes: [{ tag: 'Object' as const, universalKey: ropeId }] })
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        expect(attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph).narrationUnits).toEqual([])
    })
})

describe('attemptActionsFromTransfer', () => {
    it('keeps the primary action\'s id when it adds an exit-edge challenge', () => {
        const graph = testLudicGraphFromEnvelope(roomId, {
            nodes: [],
            edges: [{ kind: 'Navigation', uuid: 'edge-1', from: ropeId, to: postId, payload: {} }],
        })
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        const [primary] = attemptActionsFromTransfer(primaryAction, ropeId, graph).actions

        expect(primary?.challenges().map((challenge) => challenge.toJSON().kind)).toEqual(['exitEdge'])
        expect(primary?.id).toBe('primary')
    })

    describe('presence on the dissolves\' referents', () => {
        const boardId = 'OBJECT#Breadboard' as EphemeraObjectId
        const wireId = 'OBJECT#Wire' as EphemeraObjectId
        const spotId = 'OBJECT#Spot' as EphemeraObjectId
        const westHalf = 'PRESENCE#board-in-west' as EphemeraPresenceNodeId
        const eastHalf = 'PRESENCE#board-in-east' as EphemeraPresenceNodeId
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
            const [dissolve] = attemptActionsFromTransfer(takeWire, wireId, boardGraph([{ key: westHalf }, { key: eastHalf }])).actions

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: graphNodeRef(wireId, [westHalf, eastHalf]),
                target: graphNodeRef(spotId, [westHalf, eastHalf]),
            }))
        })

        // A straddling whole partitions its contents: the wire is in the west half, the spot it is
        // plugged into is in the east half, so unplugging it reaches both halves' rooms.
        it('gives each end its own bucket when an Enumerated split puts them in different ones', () => {
            const [dissolve] = attemptActionsFromTransfer(takeWire, wireId, boardGraph([
                { key: westHalf, members: [wireId] },
                { key: eastHalf, members: [spotId] },
            ])).actions

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: graphNodeRef(wireId, [westHalf]),
                target: graphNodeRef(spotId, [eastHalf]),
            }))
        })

        it('leaves both ends unlearned when the host is not a room and has no binding', () => {
            const [dissolve] = attemptActionsFromTransfer(takeWire, wireId, boardGraph([])).actions

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: { referentType: 'graphNode', groundedId: wireId },
                target: { referentType: 'graphNode', groundedId: spotId },
            }))
        })
    })
})
