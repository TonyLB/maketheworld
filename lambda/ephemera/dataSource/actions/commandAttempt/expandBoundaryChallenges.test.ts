import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testLudicGraph } from '../../positions/ludicGraph/testFixtures'
import { attemptActionsFromBoundaryOutcomes } from './expandBoundaryChallenges'
import { PositionAttemptAction } from './action'
import { graphNodeRef } from '../enrich/objectManipulation/plan/planStep'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const ropeId = 'OBJECT#Rope' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const postId = 'OBJECT#Post' as EphemeraObjectId

describe('attemptActionsFromBoundaryOutcomes', () => {
    it('adds one challenge-free action for a dissolve-classified boundary edge', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: anvilId },
            ],
            edges: [{ tag: 'Relational', from: ropeId, to: anvilId, kind: 'Against' }],
        })
        const primaryAction = new PositionAttemptAction([], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect(actions).toHaveLength(2)
        expect(actions[0]).toBe(primaryAction)
        expect(actions[1]?.challenges()).toHaveLength(0)
    })

    it('expands a boundary edge to a non-Object (Character) endpoint too', () => {
        const companionId = 'CHARACTER#Companion' as EphemeraCharacterId
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Character' as const, universalKey: companionId },
            ],
            edges: [{ tag: 'Relational', from: ropeId, to: companionId, kind: 'Against' }],
        })
        const primaryAction = new PositionAttemptAction([], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect(actions).toHaveLength(2)
        expect(actions[1]?.desiredResult).toEqual(expect.objectContaining({
            primitive: 'dissolveRelation',
            subject: graphNodeRef(ropeId),
            target: graphNodeRef(companionId),
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
        const primaryAction = new PositionAttemptAction([], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect(actions).toHaveLength(2)
        const dissolveAction = actions[1]
        const challenges = dissolveAction?.challenges() ?? []
        expect(challenges).toHaveLength(1)
        expect(challenges[0]?.detectionSource).toBe('graph')
        expect(challenges[0]?.metPropagation()).toEqual({
            edge: { from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' },
        })
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
        const primaryAction = new PositionAttemptAction([], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect((actions[1]?.toJSON() as any).desiredResult).toEqual({
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: graphNodeRef(postId),
            target: graphNodeRef(ropeId),
            relationKind: 'Custom',
            relationLabel: 'is lashed to',
        })
    })

    it('returns only the primary action when the graph has no boundary edges', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: ropeId }],
        })
        const primaryAction = new PositionAttemptAction([], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect(actions).toEqual([primaryAction])
    })
})
