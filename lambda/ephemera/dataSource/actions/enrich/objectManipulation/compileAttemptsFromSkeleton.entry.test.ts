import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardLudicNavigationEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge'

import { testLudicGraph, testLudicGraphFromEnvelope } from '../../../positions/ludicGraph/testFixtures'
import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    buildCandidatesFromIdentityCase,
} from './embeddingMatch/testing/mockVectors'
import { planSkeleton } from './plan/planSkeleton'
import { peerRelationFixture } from './peerRelationFixture'

const relationalSkeleton = (
    verb: string,
    subjectSpan: string,
    subjectKey: string,
    prep: string,
    targetSpan: string,
    targetKey: string
): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: subjectKey },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: targetKey },
]

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const catalog = [{ objectId: broomId, normalizedShortName: 'broom' }]
const relationalCatalog = [
    { objectId: broomId, normalizedShortName: 'broom' },
    { objectId: tableId, normalizedShortName: 'table' },
]

const roomGraphWithBroomAndTable = testLudicGraph(roomId, {
    nodes: [
        { tag: 'Object' as const, universalKey: broomId },
        { tag: 'Object' as const, universalKey: tableId },
    ],
})

const relationalPositionsReadDeps = () => ({
    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
    getLudicGraph: jest.fn().mockResolvedValue(roomGraphWithBroomAndTable),
})

const touchingEdge: StandardLudicNavigationEdgeData = {
    kind: 'Navigation',
    uuid: 'edge-1',
    from: broomId,
    to: tableId,
    payload: {},
}

const graphWithTouchingEdge = testLudicGraphFromEnvelope(roomId, { nodes: [], edges: [touchingEdge] })
const characterGraphWithTouchingEdge = testLudicGraphFromEnvelope(characterId, { nodes: [], edges: [touchingEdge] })
const emptyRoomGraph = testLudicGraph(roomId)
const emptyCharacterGraph = testLudicGraph(characterId)

/** Room and character graph fetches are now both issued (Slice 4b) before selection runs; respond by hostId. */
const hostAwareGetLudicGraph = (overrides: Record<string, unknown> = {}) =>
    jest.fn().mockImplementation(async (hostId: string) => (
        overrides[hostId] ?? (hostId === characterId ? emptyCharacterGraph : emptyRoomGraph)
    ))

/** Plan's primary attempt for a skeleton: the input the producers take (ISS8203 slice 1). */
const planned = (skeleton: ParseSkeleton) => {
    const plan = planSkeleton(skeleton, 'test command')
    if (plan.type !== 'attempts' || plan.attempts.length === 0) {
        throw new Error('planSkeleton produced no attempt for this skeleton')
    }
    return plan.attempts[0]
}

/** The attempt's relation step: Plan's relational template puts it in the one position action. */
const relationStepOf = (result: { type: string; attempt?: unknown }): any => {
    const actions = (result.attempt as { actions: { desiredResult?: unknown }[] }).actions
    return actions[0]?.desiredResult
}

describe('compileAttemptsFromSkeleton', () => {
    it('grounds a peer relation from its Plan attempt (Step 2b step 6; the attempt is a fixture, see peerRelationFixture)', async () => {

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put the broom under the table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
                attempts: [peerRelationFixture('put the broom under the table', relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'), { primitive: 'establishRelation', relationKind: 'Under' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: relationalCatalog,
            },
            0.9,
            {
                positionsReadDeps: relationalPositionsReadDeps(),
            }
        )

        expect(result).toMatchObject({ type: 'CommandAttempt' })
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Under',
            subject: { groundedId: broomId },
            target: { groundedId: tableId },
        })
    })

    it('grounds a held-item relation onto the character-inventory host (BD-16 sameHost, both items already share that host --- resolves as a portless crossing leg)', async () => {
        const stringId = 'OBJECT#String' as EphemeraObjectId
        const topId = 'OBJECT#Top' as EphemeraObjectId
        const heldGraph = testLudicGraph(characterId, {
            nodes: [
                { tag: 'Object' as const, universalKey: stringId },
                { tag: 'Object' as const, universalKey: topId },
            ],
        })
        const getLudicGraph = hostAwareGetLudicGraph({ [characterId]: heldGraph })

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'wrap the string around the top',
                skeleton: relationalSkeleton('put', 'string', 'stringRef', 'around', 'top', 'topRef'),
                attempts: [peerRelationFixture('wrap the string around the top', relationalSkeleton('put', 'string', 'stringRef', 'around', 'top', 'topRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'around' })],
                characterId,
                hostRoomId: roomId,
                heldInventoryCatalog: [
                    { objectId: stringId, normalizedShortName: 'string' },
                    { objectId: topId, normalizedShortName: 'top' },
                ],
            },
            0.9,
            {
                positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([characterId]), getLudicGraph },
            }
        )

        expect(result).toMatchObject({ type: 'CommandAttempt' })
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'around',
            subject: { groundedId: stringId },
            target: { groundedId: topId },
        })
    })

    it('grounds lean rope against anvil via the native skeleton pipeline', async () => {
        const anvilCatalog = [
            { objectId: 'OBJECT#Rope' as EphemeraObjectId, normalizedShortName: 'rope' },
            { objectId: 'OBJECT#Anvil' as EphemeraObjectId, normalizedShortName: 'anvil' },
        ]
        const anvilGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: 'OBJECT#Rope' as EphemeraObjectId },
                { tag: 'Object' as const, universalKey: 'OBJECT#Anvil' as EphemeraObjectId },
            ],
        })

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'lean rope against anvil',
                skeleton: relationalSkeleton('lean', 'rope', 'ropeRef', 'against', 'anvil', 'anvilRef'),
                attempts: [peerRelationFixture('lean rope against anvil', relationalSkeleton('lean', 'rope', 'ropeRef', 'against', 'anvil', 'anvilRef'), { primitive: 'establishRelation', relationKind: 'Against' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: anvilCatalog,
            },
            0.88,
            {
                positionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
                    getLudicGraph: jest.fn().mockResolvedValue(anvilGraph),
                },
            }
        )

        expect(result).toMatchObject({ type: 'CommandAttempt' })
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Against',
            subject: { groundedId: 'OBJECT#Rope' },
            target: { groundedId: 'OBJECT#Anvil' },
        })
    })

    it('grounds establish fixture tie cord around crate via the native skeleton pipeline ("tie" is an establish verb)', async () => {
        const cordId = 'OBJECT#Cord' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'tie cord around crate',
                skeleton: relationalSkeleton('tie', 'cord', 'cordRef', 'around', 'crate', 'crateRef'),
                attempts: [peerRelationFixture('tie cord around crate', relationalSkeleton('tie', 'cord', 'cordRef', 'around', 'crate', 'crateRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'around' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cordId, normalizedShortName: 'cord' },
                    { objectId: crateId, normalizedShortName: 'crate' },
                ],
            },
            0.87,
            {
                positionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
                    getLudicGraph: jest.fn().mockResolvedValue(testLudicGraph(roomId, {
                        nodes: [
                            { tag: 'Object' as const, universalKey: cordId },
                            { tag: 'Object' as const, universalKey: crateId },
                        ],
                    })),
                },
            }
        )

        expect(result).toMatchObject({ type: 'CommandAttempt' })
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'around',
            subject: { groundedId: cordId },
            target: { groundedId: crateId },
        })
    })

    it('grounds dissolve fixture take rope off crate via the native skeleton pipeline', async () => {
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'take rope off crate',
                skeleton: relationalSkeleton('take', 'rope', 'ropeRef', 'off', 'crate', 'crateRef'),
                attempts: [peerRelationFixture('take rope off crate', relationalSkeleton('take', 'rope', 'ropeRef', 'off', 'crate', 'crateRef'), { primitive: 'dissolveRelation', relationKind: 'Custom', relationLabel: 'off' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: ropeId, normalizedShortName: 'rope' },
                    { objectId: crateId, normalizedShortName: 'crate' },
                ],
            },
            0.86,
            {
                positionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
                    getLudicGraph: jest.fn().mockResolvedValue(testLudicGraph(roomId, {
                        nodes: [
                            { tag: 'Object' as const, universalKey: ropeId },
                            { tag: 'Object' as const, universalKey: crateId },
                        ],
                        edges: [{
                            tag: 'Relational',
                            from: ropeId,
                            to: crateId,
                            kind: 'Custom',
                            relationLabel: 'off',
                        }],
                    })),
                },
            }
        )

        expect(result).toMatchObject({ type: 'CommandAttempt' })
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'dissolveRelation',
            relationKind: 'Custom',
            relationLabel: 'off',
            subject: { groundedId: ropeId },
            target: { groundedId: crateId },
        })
    })

    it('grounds a Custom peer relation from its Plan attempt (the attempt is a fixture, see peerRelationFixture)', async () => {
        const ladderId = 'OBJECT#Ladder' as EphemeraObjectId
        const wallId = 'OBJECT#Wall' as EphemeraObjectId

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'lean the ladder leaning against the wall',
                skeleton: relationalSkeleton('lean', 'ladder', 'ladderRef', 'leaning against', 'wall', 'wallRef'),
                attempts: [peerRelationFixture('lean the ladder leaning against the wall', relationalSkeleton('lean', 'ladder', 'ladderRef', 'leaning against', 'wall', 'wallRef'), { primitive: 'establishRelation', relationKind: 'Against' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: ladderId, normalizedShortName: 'ladder' },
                    { objectId: wallId, normalizedShortName: 'wall' },
                ],
            },
            0.9,
            {
                positionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
                    getLudicGraph: jest.fn().mockResolvedValue(testLudicGraph(roomId, {
                        nodes: [
                            { tag: 'Object' as const, universalKey: ladderId },
                            { tag: 'Object' as const, universalKey: wallId },
                        ],
                    })),
                },
            }
        )

        expect(result).toMatchObject({ type: 'CommandAttempt' })
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Against',
            subject: { groundedId: ladderId },
            target: { groundedId: wallId },
        })
    })

})

describe('compileAttemptsFromSkeleton (a mixed pool, ISS8203 slice 4.5)', () => {
    const lookSkeleton: ParseSkeleton = [
        { type: 'text', text: 'look' },
        { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
    ]
    const takeSkeleton: ParseSkeleton = [
        { type: 'text', text: 'take' },
        { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
    ]
    const relationSkeletonForPool = relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef')

    it('a look survives a take that has no room, so the pool answers the look', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look broom',
                skeleton: lookSkeleton,
                attempts: [planned(takeSkeleton), planned(lookSkeleton)],
                characterId,
                roomObjectCatalog: catalog,
            },
            0.9
        )

        expect(result.type).toBe('CommandAttempt')
        if (result.type === 'CommandAttempt') {
            expect(result.attempt.actions).toHaveLength(1)
        }
    })

    it('a relation with no room graph is refused alone, and the look still answers', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look broom',
                skeleton: lookSkeleton,
                attempts: [peerRelationFixture('look broom', relationSkeletonForPool, { primitive: 'establishRelation', relationKind: 'Under' }), planned(lookSkeleton)],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: relationalCatalog,
            },
            0.9,
            {
                positionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
                    getLudicGraph: jest.fn().mockResolvedValue(undefined),
                },
            }
        )

        expect(result.type).toBe('CommandAttempt')
    })

    it('when nothing survives, the first refusal in Plan\'s order is returned', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'take broom',
                skeleton: takeSkeleton,
                attempts: [planned(takeSkeleton), peerRelationFixture('take broom', relationSkeletonForPool, { primitive: 'establishRelation', relationKind: 'Under' })],
                characterId,
                roomObjectCatalog: relationalCatalog,
            },
            0.9
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noMembershipHost })
    })
})
