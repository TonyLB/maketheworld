import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { runIdentityStage } from './identityStage'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import {
    buildCandidatesFromIdentityCase,
    makeEmbeddingFromAxis,
} from './embeddingMatch/testing/mockVectors'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId

const roomCatalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
]

describe('runIdentityStage', () => {
    it('resolves span deterministically without Bedrock', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn()
        const embedSpan = jest.fn()

        const result = await runIdentityStage(
            'pick up the broom',
            ['broom'],
            roomCatalog,
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result).toEqual({
            type: 'success',
            spanGroundings: [{
                type: 'resolved',
                objectId: broomId,
                catalogScope: 'room',
            }],
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).not.toHaveBeenCalled()
        expect(embedSpan).not.toHaveBeenCalled()
    })

    it('invokes identity LLM on NoMatch when catalog has no embeddings', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `{"objectId":"${broomId}"}`,
        })
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbeddingFromAxis(0),
        })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            roomCatalog,
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result).toEqual({
            type: 'success',
            spanGroundings: [{
                type: 'resolved',
                objectId: broomId,
                catalogScope: 'room',
            }],
        })
        expect(embedSpan).toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalled()
    })

    it('resolves paraphrase via embedding without identity LLM', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom', 'anvil'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: 0.95,
                otherSimilarity: 0.5,
            }
        )
        const catalog: ObjectManipulationCatalogEntry[] = candidates.map((candidate) => ({
            objectId: candidate.objectId === candidates[0]!.objectId ? broomId : anvilId,
            normalizedShortName: candidate.normalizedShortName,
            catalogScope: 'room' as const,
            embedding: candidate.embedding,
        }))

        const invokeBedrockObjectManipulationIdentityImpl = jest.fn()
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            catalog,
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result).toEqual({
            type: 'success',
            spanGroundings: [{
                type: 'resolved',
                objectId: broomId,
                catalogScope: 'room',
            }],
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).not.toHaveBeenCalled()
        expect(embedSpan).toHaveBeenCalled()
    })

    it('falls through to identity LLM when embedding abstains on absent-object span', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-absent',
                bucket: 'absent-object',
                span: 'sword',
                catalog: ['broom', 'anvil'],
            },
            { kind: 'orthogonal-to-catalog' }
        )
        const catalog: ObjectManipulationCatalogEntry[] = candidates.map((candidate, index) => ({
            objectId: index === 0 ? broomId : anvilId,
            normalizedShortName: candidate.normalizedShortName,
            catalogScope: 'room' as const,
            embedding: candidate.embedding,
        }))

        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `{"objectId":"${broomId}"}`,
        })
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await runIdentityStage(
            'pick up the sword',
            ['sword'],
            catalog,
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result.type).toBe('success')
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalledTimes(1)
    })

    it('falls through to identity LLM on embed invoke failure without terminal error', async () => {
        const catalog: ObjectManipulationCatalogEntry[] = [{
            objectId: broomId,
            normalizedShortName: 'broom',
            catalogScope: 'room',
            embedding: makeEmbeddingFromAxis(1),
        }]
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `{"objectId":"${broomId}"}`,
        })
        const embedSpan = jest.fn().mockResolvedValue({ success: false })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            catalog,
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result).toEqual({
            type: 'success',
            spanGroundings: [{
                type: 'resolved',
                objectId: broomId,
                catalogScope: 'room',
            }],
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalledTimes(1)
    })

    it('fails closed when identity LLM returns invalid JSON', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: 'not json',
        })

        const result = await runIdentityStage(
            'pick up the thing',
            ['thing'],
            roomCatalog,
            { invokeBedrockObjectManipulationIdentityImpl }
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.identityParseFailed,
        })
    })

    it('returns noCatalog error when catalog is empty and span does not match', async () => {
        const result = await runIdentityStage('pick up broom', ['broom'], [])

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noCatalog,
        })
    })
})
