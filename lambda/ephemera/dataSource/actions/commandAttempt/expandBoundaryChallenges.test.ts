import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testLudicGraph, testLudicGraphFromEnvelope } from '../../positions/ludicGraph/testFixtures'
import { attemptActionsFromBoundaryOutcomes, attemptActionsFromTransfer } from './expandBoundaryChallenges'
import { PositionAttemptAction } from './action'
import { graphNodeRef, type GroundedPresence, type TransferMembershipChange } from '../enrich/objectManipulation/plan/planStep'

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

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect(actions).toHaveLength(2)
        expect(actions[0]?.desiredResult).toEqual(expect.objectContaining({
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
        const primaryAction = new PositionAttemptAction('action-2', [], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

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

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect((actions[0]?.toJSON() as any).desiredResult).toEqual({
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: graphNodeRef(postId),
            target: graphNodeRef(ropeId),
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

        const ids = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph).map((action) => action.id)

        expect(ids).toHaveLength(3)
        expect(ids[2]).toBe('primary')
        expect(new Set(ids).size).toBe(3)
    })

    it('returns only the primary action when the graph has no boundary edges', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: ropeId }],
        })
        const primaryAction = new PositionAttemptAction('action-4', [], undefined, 'Take: rope')

        const actions = attemptActionsFromBoundaryOutcomes(primaryAction, new Set([ropeId]), graph)

        expect(actions).toEqual([primaryAction])
    })
})

describe('attemptActionsFromTransfer', () => {
    it('keeps the primary action\'s id when it adds an exit-edge challenge', () => {
        const graph = testLudicGraphFromEnvelope(roomId, {
            nodes: [],
            edges: [{ kind: 'Navigation', uuid: 'edge-1', from: ropeId, to: postId, payload: {} }],
        })
        const primaryAction = new PositionAttemptAction('primary', [], undefined, 'Take: rope')

        const [primary] = attemptActionsFromTransfer(primaryAction, ropeId, graph)

        expect(primary?.challenges().map((challenge) => challenge.toJSON().kind)).toEqual(['exitEdge'])
        expect(primary?.id).toBe('primary')
    })

    describe('presence on the dissolves\' referents', () => {
        const characterId = 'CHARACTER#Tess' as EphemeraCharacterId
        const lashedGraph = () => testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
            ],
            edges: [{ tag: 'Relational', from: postId, to: ropeId, kind: 'Custom', relationLabel: 'is lashed to' }],
        })
        const takeRope = (groundedPresence?: GroundedPresence) => {
            const desiredResult: TransferMembershipChange = {
                kind: 'change',
                primitive: 'transferMembership',
                object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'objectRef', groundedId: ropeId, ...(groundedPresence !== undefined ? { groundedPresence } : {}) },
                from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'objectRef' }, groundedId: roomId },
                to: { referentType: 'actingCharacter', groundedId: characterId },
            }
            return new PositionAttemptAction('primary', [], desiredResult, 'Take: rope')
        }

        it('gives both ends the moved object\'s presence, since the edge was read from its host\'s graph', () => {
            const boxBinding = 'PRESENCE#box-in-bridge' as EphemeraPresenceNodeId

            const [dissolve] = attemptActionsFromTransfer(takeRope(boxBinding), ropeId, lashedGraph())

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: graphNodeRef(postId, boxBinding),
                target: graphNodeRef(ropeId, boxBinding),
            }))
        })

        it('leaves both ends unlearned when the moved object\'s presence is', () => {
            const [dissolve] = attemptActionsFromTransfer(takeRope(), ropeId, lashedGraph())

            expect(dissolve?.desiredResult).toEqual(expect.objectContaining({
                subject: { referentType: 'graphNode', groundedId: postId },
                target: { referentType: 'graphNode', groundedId: ropeId },
            }))
        })
    })
})
