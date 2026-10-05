import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardLudicNavigationEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge'

import { testLudicGraph, testLudicGraphFromEnvelope } from '../../../positions/ludicGraph/testFixtures'
import { enrichObjectManipulation } from './index'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    buildCandidatesFromIdentityCase,
} from './embeddingMatch/testing/mockVectors'
import { planSkeleton } from './plan/planSkeleton'

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

describe('enrichObjectManipulation', () => {
    it('routes relational commands through the native skeleton pipeline (Step 2b step 6)', async () => {

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'put the broom under the table',
                rawObjectSpans: ['broom'],
                parseSkeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
                attempt: planned(relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef')),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: relationalCatalog,
            },
            0.9,
            {
                positionsReadDeps: relationalPositionsReadDeps(),
            }
        )

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            relationKind: 'Under',
            confidence: 0.9,
            steps: [{
                kind: 'establishRelation',
                subjectId: broomId,
                targetId: tableId,
                relationKind: 'Under',
                hostId: roomId,
            }],
            attempt: expect.anything(),
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

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'wrap the string around the top',
                rawObjectSpans: ['string'],
                parseSkeleton: relationalSkeleton('put', 'string', 'stringRef', 'around', 'top', 'topRef'),
                attempt: planned(relationalSkeleton('put', 'string', 'stringRef', 'around', 'top', 'topRef')),
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

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: stringId,
            targetId: topId,
            relationKind: 'Custom',
            relationLabel: 'around',
            confidence: 0.9,
            steps: [{
                kind: 'establishRelation',
                subjectId: stringId,
                targetId: topId,
                relationKind: 'Custom',
                relationLabel: 'around',
                hostId: characterId,
            }],
            attempt: expect.anything(),
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

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'lean rope against anvil',
                rawObjectSpans: ['rope'],
                parseSkeleton: relationalSkeleton('lean', 'rope', 'ropeRef', 'against', 'anvil', 'anvilRef'),
                attempt: planned(relationalSkeleton('lean', 'rope', 'ropeRef', 'against', 'anvil', 'anvilRef')),
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

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: 'OBJECT#Rope',
            targetId: 'OBJECT#Anvil',
            relationKind: 'Against',
            confidence: 0.88,
            steps: [{
                kind: 'establishRelation',
                subjectId: 'OBJECT#Rope',
                targetId: 'OBJECT#Anvil',
                relationKind: 'Against',
                hostId: roomId,
            }],
            attempt: expect.anything(),
        })
    })

    it('grounds establish fixture tie cord around crate via the native skeleton pipeline ("tie" joined ESTABLISH_VERBS)', async () => {
        const cordId = 'OBJECT#Cord' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'tie cord around crate',
                rawObjectSpans: ['cord'],
                parseSkeleton: relationalSkeleton('tie', 'cord', 'cordRef', 'around', 'crate', 'crateRef'),
                attempt: planned(relationalSkeleton('tie', 'cord', 'cordRef', 'around', 'crate', 'crateRef')),
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

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: cordId,
            targetId: crateId,
            relationKind: 'Custom',
            relationLabel: 'around',
            confidence: 0.87,
            steps: [{
                kind: 'establishRelation',
                subjectId: cordId,
                targetId: crateId,
                relationKind: 'Custom',
                relationLabel: 'around',
                hostId: roomId,
            }],
            attempt: expect.anything(),
        })
    })

    it('grounds dissolve fixture take rope off crate via the native skeleton pipeline', async () => {
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'take rope off crate',
                rawObjectSpans: ['rope'],
                parseSkeleton: relationalSkeleton('take', 'rope', 'ropeRef', 'off', 'crate', 'crateRef'),
                attempt: planned(relationalSkeleton('take', 'rope', 'ropeRef', 'off', 'crate', 'crateRef')),
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

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'dissolveRelation',
            subjectId: ropeId,
            targetId: crateId,
            relationKind: 'Custom',
            relationLabel: 'off',
            confidence: 0.86,
            steps: [{
                kind: 'dissolveRelation',
                subjectId: ropeId,
                targetId: crateId,
                relationKind: 'Custom',
                relationLabel: 'off',
                hostId: roomId,
            }],
            attempt: expect.anything(),
        })
    })

    it('abstains on a containment attempt on the relational route (containment is parseCommand\'s route)', async () => {

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'put the coin in the jar',
                rawObjectSpans: ['coin'],
                parseSkeleton: relationalSkeleton('put', 'coin', 'coinRef', 'in', 'jar', 'jarRef'),
                attempt: planned(relationalSkeleton('put', 'coin', 'coinRef', 'in', 'jar', 'jarRef')),
                roomObjectCatalog: [{ objectId: 'OBJECT#Coin' as EphemeraObjectId, normalizedShortName: 'coin' }],
            },
            0.9,
            {}
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: objectManipulationErrorMessages.relationalNoTemplateMatch,
        })
    })

    it('returns a defensive Error when the relational route is called without a parseSkeleton', async () => {
        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'put the coin in the jar',
                rawObjectSpans: ['coin'],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.relationalNoTemplateMatch,
        })
    })

    it('routes relational enrichRoute with a non-enum preposition to a Custom relation via the native pipeline', async () => {
        const ladderId = 'OBJECT#Ladder' as EphemeraObjectId
        const wallId = 'OBJECT#Wall' as EphemeraObjectId

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'lean the ladder leaning against the wall',
                rawObjectSpans: ['ladder'],
                parseSkeleton: relationalSkeleton('lean', 'ladder', 'ladderRef', 'leaning against', 'wall', 'wallRef'),
                attempt: planned(relationalSkeleton('lean', 'ladder', 'ladderRef', 'leaning against', 'wall', 'wallRef')),
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

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: ladderId,
            targetId: wallId,
            relationKind: 'Against',
            confidence: 0.9,
            steps: [{
                kind: 'establishRelation',
                subjectId: ladderId,
                targetId: wallId,
                relationKind: 'Against',
                hostId: roomId,
            }],
            attempt: expect.anything(),
        })
    })

})
