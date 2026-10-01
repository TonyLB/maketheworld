import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { groundMembershipCandidates, planMembershipDesiredResult } from './groundMembershipCandidates'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { withGroundedId } from './plan/planStep'
import { buildSandboxState } from './sandboxState'
import type { SpanCandidateLocus } from './spanResolution'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const ropeId = 'OBJECT#Rope' as EphemeraObjectId
const postId = 'OBJECT#Post' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId

const catalog: ObjectManipulationCatalogEntry[] = [
    { objectId: ropeId, normalizedShortName: 'rope', catalogScope: 'room', gloss: 'a coil of hemp rope' },
    { objectId: postId, normalizedShortName: 'post', catalogScope: 'room' },
    { objectId: satchelId, normalizedShortName: 'satchel', catalogScope: 'held' },
]

const roomGraph = testLudicGraph(roomId, {
    nodes: [
        { tag: 'Object' as const, universalKey: ropeId },
        { tag: 'Object' as const, universalKey: postId },
    ],
    edges: [{ tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' }],
})
const characterGraph = testLudicGraph(characterId, {
    nodes: [{ tag: 'Object' as const, universalKey: satchelId }],
})

const candidate = (
    objectId: EphemeraObjectId,
    locus: SpanCandidateLocus,
    operationKind: 'takeHold' | 'drop'
): IdentityPlanCandidate => ({
    identity: { objectId, label: objectId, locus, jointRelevance: 0.8, sourceTags: ['exact'] },
    plan: { kind: 'transferMembership', operationKind },
    confidence: 0.8,
})

const context = {
    words: 'take the rope',
    span: 'rope',
    catalog,
    sandboxState: buildSandboxState([roomGraph, characterGraph]),
    roomId,
    actorCharacterId: characterId,
}

describe('groundMembershipCandidates', () => {
    it('builds one grounded attempt per tuple, its primary action wrapping the carried desired result', () => {
        const grounded = groundMembershipCandidates(
            [candidate(ropeId, { kind: 'room' }, 'takeHold'), candidate(satchelId, { kind: 'heldByActor' }, 'takeHold')],
            context
        )

        expect(grounded).toHaveLength(2)
        for (const entry of grounded) {
            const planned = planMembershipDesiredResult('takeHold', 'rope')
            expect(entry.desiredResult).toEqual({ ...planned, object: withGroundedId(planned.object, entry.identity.objectId) })
            expect(entry.attempt.toJSON().actions[0]).toEqual(
                expect.objectContaining({ desiredResult: entry.desiredResult })
            )
            expect(entry.attempt.words).toBe('take the rope')
        }
        expect(grounded[0]!.identity.objectId).toBe(ropeId)
        expect(grounded[1]!.identity.objectId).toBe(satchelId)
    })

    it('expands a Custom-tied object from its locus graph into a dissolve action carrying a CustomEdgeChallenge', () => {
        const [grounded] = groundMembershipCandidates([candidate(ropeId, { kind: 'room' }, 'takeHold')], context)

        const actions = grounded!.attempt.toJSON().actions
        expect(actions).toHaveLength(2)
        expect(actions[0]?.challenges).toEqual([])
        expect(actions[1]?.challenges).toEqual([
            expect.objectContaining({ kind: 'customEdge', description: expect.stringContaining('is lashed to') }),
        ])
    })

    it('adjudicates each attempt: the Custom-edge challenge is met, so row 6\'s attempt succeeds', () => {
        const [grounded] = groundMembershipCandidates([candidate(ropeId, { kind: 'room' }, 'takeHold')], context)

        expect(grounded!.attempt.toJSON().actions[1]?.challenges[0]?.verdict).toEqual({ kind: 'met' })
        expect(grounded!.attempt.result.status).toBe('succeeded')
    })

    it('grounds the referent from the catalog, gloss included', () => {
        const [grounded] = groundMembershipCandidates([candidate(ropeId, { kind: 'room' }, 'takeHold')], context)

        expect(grounded!.attempt.referents()).toEqual([
            { refKey: 'primaryObject', id: ropeId, shortName: 'rope', gloss: 'a coil of hemp rope' },
        ])
    })

    it('grounds the referent but skips expansion when the locus has no source graph', () => {
        const [grounded] = groundMembershipCandidates(
            [candidate(ropeId, { kind: 'withinObject', hostId: postId, hostLabel: 'post' }, 'takeHold')],
            context
        )

        expect(grounded!.attempt.toJSON().actions).toEqual([
            expect.objectContaining({ desiredResultDescription: 'Take: rope', challenges: [] }),
        ])
        expect(grounded!.attempt.referents()[0]?.id).toBe(ropeId)
    })
})
