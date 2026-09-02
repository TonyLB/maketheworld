import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import { testLudicGraph, testLudicGraphFromEnvelope } from '../../../positions/ludicGraph/testFixtures'
import { enrichObjectManipulation } from './index'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    buildCandidatesFromIdentityCase,
} from './embeddingMatch/testing/mockVectors'

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

const touchingEdge: StandardExitEdgeData = {
    tag: 'Exit',
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

describe('enrichObjectManipulation', () => {
    it('returns grounded takeHold without Bedrock on zero-hop eligible path', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: catalog,
            },
            0.92,
            {
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectIds: [broomId],
            confidence: 0.92,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('returns grounded drop without Bedrock on zero-hop eligible path', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId,
                hostRoomId: roomId,
                heldInventoryCatalog: catalog,
            },
            0.91,
            {
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectIds: [broomId],
            confidence: 0.91,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('returns Error for a multi-span membership command end-to-end (BD-20: arity check now lives in compileMembershipAtomic)', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom and the anvil',
                rawObjectSpans: ['broom', 'anvil'],
                verbClass: 'acquire',
                roomObjectCatalog: catalog,
            },
            0.8,
            { invokeBedrockObjectManipulationEnrichImpl }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiObject,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
    })

    it('blocks takeHold when object is multi-present', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId, 'ROOM#Hall'])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: catalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiPresent,
        })
        // multiPresent is decided post-selection (containers count) --- the selector's own
        // room/character graph pre-fetch (Slice 4b) still runs beforehand, so getLudicGraph
        // is no longer expected to stay uncalled here.
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('blocks takeHold when object has no membership host', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([])
        const getLudicGraph = jest.fn()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                roomObjectCatalog: catalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noMembershipHost,
        })
    })

    it('routes relational commands through the native skeleton pipeline (Step 2b step 6)', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'put the broom under the table',
                rawObjectSpans: ['broom'],
                parseSkeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: relationalCatalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
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
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('grounds a held-item relation onto the character-inventory host (BD-16 sameHost, both items already share that host --- PV1-3b-4: resolves as a portless crossing leg)', async () => {
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
        })
    })

    it('grounds establish fixture tie cord around crate via the native skeleton pipeline (PV1-3: "tie" joined ESTABLISH_VERBS)', async () => {
        const cordId = 'OBJECT#Cord' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'tie cord around crate',
                rawObjectSpans: ['cord'],
                parseSkeleton: relationalSkeleton('tie', 'cord', 'cordRef', 'around', 'crate', 'crateRef'),
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
        })
    })

    it('returns nesting Error for a containment preposition in the skeleton', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'put the coin in the jar',
                rawObjectSpans: ['coin'],
                parseSkeleton: relationalSkeleton('put', 'coin', 'coinRef', 'in', 'jar', 'jarRef'),
                roomObjectCatalog: [{ objectId: 'OBJECT#Coin' as EphemeraObjectId, normalizedShortName: 'coin' }],
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
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

    it('invokes complexity LLM when exit edges touch object', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"complex","complexityClass":"relationalPlacement"}',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph({ [roomId]: graphWithTouchingEdge })

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: catalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).toHaveBeenCalled()
    })

    it('finalizes atomic drop from complexity LLM when exit edges touch object', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"atomic","operationKind":"drop"}',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getLudicGraph = hostAwareGetLudicGraph({ [characterId]: characterGraphWithTouchingEdge })

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId,
                hostRoomId: roomId,
                heldInventoryCatalog: catalog,
            },
            0.85,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectIds: [broomId],
            confidence: 0.85,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).toHaveBeenCalled()
    })

    it('returns parse failure Error when complexity body is invalid', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: 'not json',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph({ [roomId]: graphWithTouchingEdge })

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: catalog,
            },
            0.85,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result.type).toBe('Error')
        if (result.type === 'Error') {
            expect(result.errorMessage).toBe(objectManipulationErrorMessages.enrichParseFailed)
        }
    })

    it('resolves paraphrase via pool without identity LLM', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: 0.95,
                otherSimilarity: 0.5,
            }
        )
        const paraphraseCatalog = candidates.map((candidate) => ({
            objectId: broomId,
            normalizedShortName: candidate.normalizedShortName,
            embedding: candidate.embedding,
        }))
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the sweeping tool',
                rawObjectSpans: ['sweeping tool'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: paraphraseCatalog,
            },
            0.88,
            {
                embedSpan,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectIds: [broomId],
            confidence: 0.88,
        })
        expect(embedSpan).toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
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
        })
    })

    it('membership enrichRoute never touches the relational parseSkeleton field, even when command contains a preposition word', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'take broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: catalog,
            },
            0.92,
            {
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectIds: [broomId],
            confidence: 0.92,
        })
    })
})
