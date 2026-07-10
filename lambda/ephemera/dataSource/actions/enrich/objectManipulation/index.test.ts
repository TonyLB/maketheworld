import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import { testPositionGraph, testPositionGraphFromEnvelope } from '../../../positions/positionGraph/testFixtures'
import { enrichObjectManipulation } from './index'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    buildCandidatesFromIdentityCase,
} from './embeddingMatch/testing/mockVectors'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const catalog = [{ objectId: broomId, normalizedShortName: 'broom' }]
const relationalCatalog = [
    { objectId: broomId, normalizedShortName: 'broom' },
    { objectId: tableId, normalizedShortName: 'table' },
]

const roomGraphWithBroomAndTable = testPositionGraph(roomId, {
    nodes: [
        { tag: 'Object' as const, universalKey: broomId },
        { tag: 'Object' as const, universalKey: tableId },
    ],
})

const relationalPositionsReadDeps = () => ({
    getMembershipContainers: jest.fn(),
    getPositionGraph: jest.fn().mockResolvedValue(roomGraphWithBroomAndTable),
})

const touchingEdge: StandardExitEdgeData = {
    tag: 'Exit',
    uuid: 'edge-1',
    from: broomId,
    to: tableId,
    payload: {},
}

const graphWithTouchingEdge = testPositionGraphFromEnvelope(roomId, { nodes: [], edges: [touchingEdge] })
const emptyRoomGraph = testPositionGraph(roomId)
const emptyCharacterGraph = testPositionGraph(characterId)

describe('enrichObjectManipulation', () => {
    it('returns grounded takeHold without Bedrock on zero-hop eligible path', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue(emptyRoomGraph)

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                roomObjectCatalog: catalog,
            },
            0.92,
            {
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.92,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('returns grounded drop without Bedrock on zero-hop eligible path', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getPositionGraph = jest.fn().mockResolvedValue(emptyCharacterGraph)

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId,
                heldInventoryCatalog: catalog,
            },
            0.91,
            {
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectId: broomId,
            confidence: 0.91,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('returns Error for complex disposition stub via cardinality', async () => {
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

    it('short-circuits multiObject via cardinality gate without Bedrock', async () => {
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
        const getPositionGraph = jest.fn()

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
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiPresent,
        })
        expect(getPositionGraph).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('blocks takeHold when object has no membership host', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([])
        const getPositionGraph = jest.fn()

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
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noMembershipHost,
        })
    })

    it('routes relational commands through frame extract and compiler', async () => {
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on","operationKind":"establishRelation"}',
        })
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'put the broom on the table',
                rawObjectSpans: ['broom'],
                hostRoomId: roomId,
                roomObjectCatalog: relationalCatalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationFrameExtractImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: relationalPositionsReadDeps(),
            }
        )

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            relationKind: 'On',
            hostRoomId: roomId,
            confidence: 0.9,
        })
        expect(invokeBedrockObjectManipulationFrameExtractImpl).toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('frame-extracts lean rope against anvil fixture', async () => {
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"subjectSpan":"rope","targetSpan":"anvil","relationSpan":"against","operationKind":"establishRelation"}',
        })
        const anvilCatalog = [
            { objectId: 'OBJECT#Rope' as EphemeraObjectId, normalizedShortName: 'rope' },
            { objectId: 'OBJECT#Anvil' as EphemeraObjectId, normalizedShortName: 'anvil' },
        ]
        const anvilGraph = testPositionGraph(roomId, {
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
                hostRoomId: roomId,
                roomObjectCatalog: anvilCatalog,
            },
            0.88,
            {
                invokeBedrockObjectManipulationFrameExtractImpl,
                positionsReadDeps: {
                    getMembershipContainers: jest.fn(),
                    getPositionGraph: jest.fn().mockResolvedValue(anvilGraph),
                },
            }
        )

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: 'OBJECT#Rope',
            targetId: 'OBJECT#Anvil',
            relationKind: 'Against',
            hostRoomId: roomId,
            confidence: 0.88,
        })
        expect(invokeBedrockObjectManipulationFrameExtractImpl).toHaveBeenCalled()
    })

    it('frame-extracts tie cord around crate fixture', async () => {
        const cordId = 'OBJECT#Cord' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"subjectSpan":"cord","targetSpan":"crate","relationSpan":"around","operationKind":"establishRelation"}',
        })

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'tie cord around crate',
                rawObjectSpans: ['cord'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cordId, normalizedShortName: 'cord' },
                    { objectId: crateId, normalizedShortName: 'crate' },
                ],
            },
            0.87,
            {
                invokeBedrockObjectManipulationFrameExtractImpl,
                positionsReadDeps: {
                    getMembershipContainers: jest.fn(),
                    getPositionGraph: jest.fn().mockResolvedValue(testPositionGraph(roomId, {
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
            hostRoomId: roomId,
            confidence: 0.87,
        })
        expect(invokeBedrockObjectManipulationFrameExtractImpl).toHaveBeenCalled()
    })

    it('frame-extracts dissolve fixture take rope off crate', async () => {
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"subjectSpan":"rope","targetSpan":"crate","relationSpan":"off","operationKind":"dissolveRelation"}',
        })

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'take rope off crate',
                rawObjectSpans: ['rope'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: ropeId, normalizedShortName: 'rope' },
                    { objectId: crateId, normalizedShortName: 'crate' },
                ],
            },
            0.86,
            {
                invokeBedrockObjectManipulationFrameExtractImpl,
                positionsReadDeps: {
                    getMembershipContainers: jest.fn(),
                    getPositionGraph: jest.fn().mockResolvedValue(testPositionGraph(roomId, {
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
            hostRoomId: roomId,
            confidence: 0.86,
        })
    })

    it('returns nesting Error for containment frame extract', async () => {
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"subjectSpan":"coin","targetSpan":"jar","relationSpan":"in","operationKind":"establishRelation"}',
        })
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'put the coin in the jar',
                rawObjectSpans: ['coin'],
                roomObjectCatalog: [{ objectId: 'OBJECT#Coin' as EphemeraObjectId, normalizedShortName: 'coin' }],
            },
            0.9,
            {
                invokeBedrockObjectManipulationFrameExtractImpl,
                invokeBedrockObjectManipulationComplexityImpl,
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        })
        expect(invokeBedrockObjectManipulationFrameExtractImpl).toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('invokes complexity LLM when exit edges touch object', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"complex","complexityClass":"relationalPlacement"}',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue(graphWithTouchingEdge)

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
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
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
        const getPositionGraph = jest.fn().mockResolvedValue(graphWithTouchingEdge)

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId,
                heldInventoryCatalog: catalog,
            },
            0.85,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectId: broomId,
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
        const getPositionGraph = jest.fn().mockResolvedValue(graphWithTouchingEdge)

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                roomObjectCatalog: catalog,
            },
            0.85,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
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
        const getPositionGraph = jest.fn().mockResolvedValue(emptyRoomGraph)

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'pick up the sweeping tool',
                rawObjectSpans: ['sweeping tool'],
                verbClass: 'acquire',
                roomObjectCatalog: paraphraseCatalog,
            },
            0.88,
            {
                embedSpan,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.88,
        })
        expect(embedSpan).toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('routes relational enrichRoute without listed prepositions through frame extract', async () => {
        const ladderId = 'OBJECT#Ladder' as EphemeraObjectId
        const wallId = 'OBJECT#Wall' as EphemeraObjectId
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"subjectSpan":"ladder","targetSpan":"wall","relationSpan":"leaning against","operationKind":"establishRelation"}',
        })

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: 'lean the ladder against the wall',
                rawObjectSpans: ['ladder'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: ladderId, normalizedShortName: 'ladder' },
                    { objectId: wallId, normalizedShortName: 'wall' },
                ],
            },
            0.9,
            {
                invokeBedrockObjectManipulationFrameExtractImpl,
                positionsReadDeps: {
                    getMembershipContainers: jest.fn(),
                    getPositionGraph: jest.fn().mockResolvedValue(testPositionGraph(roomId, {
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
            hostRoomId: roomId,
            confidence: 0.9,
        })
        expect(invokeBedrockObjectManipulationFrameExtractImpl).toHaveBeenCalled()
    })

    it('membership enrichRoute skips frame extract even when command contains a preposition word', async () => {
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn()
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue(emptyRoomGraph)

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: 'take broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                roomObjectCatalog: catalog,
            },
            0.92,
            {
                invokeBedrockObjectManipulationFrameExtractImpl,
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.92,
        })
        expect(invokeBedrockObjectManipulationFrameExtractImpl).not.toHaveBeenCalled()
    })
})
