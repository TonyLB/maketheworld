import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { resolveRelationalGrounding } from './resolveRelationalGrounding'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    buildCandidatesFromIdentityCase,
    makeEmbeddingFromAxis,
} from './embeddingMatch/testing/mockVectors'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId

describe('resolveRelationalGrounding', () => {
    it('resolves subject and target deterministically from room catalog', async () => {
        const result = await resolveRelationalGrounding(
            'put broom on table',
            'broom',
            'table',
            [
                { objectId: broomId, normalizedShortName: 'broom' },
                { objectId: tableId, normalizedShortName: 'table' },
            ]
        )

        expect(result).toEqual({
            type: 'success',
            subjectId: broomId,
            targetId: tableId,
        })
    })

    it('returns error when subject and target resolve to same object', async () => {
        const result = await resolveRelationalGrounding(
            'put broom on broom',
            'broom',
            'broom',
            [{ objectId: broomId, normalizedShortName: 'broom' }]
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.sameSubjectAndTarget,
        })
    })

    it('returns error when identity LLM invoke fails', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: false,
        })

        const result = await resolveRelationalGrounding(
            'put broom on table',
            'broom',
            'table',
            [{ objectId: broomId, normalizedShortName: 'broom' }],
            { invokeBedrockObjectManipulationIdentityImpl }
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.identityInvokeFailed,
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalled()
    })

    it('resolves paraphrase subject via embedding without identity LLM', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom', 'table'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: 0.95,
                otherSimilarity: 0.5,
            }
        )
        const catalog = candidates.map((candidate, index) => ({
            objectId: index === 0 ? broomId : tableId,
            normalizedShortName: candidate.normalizedShortName,
            embedding: candidate.embedding,
        }))

        const invokeBedrockObjectManipulationIdentityImpl = jest.fn()
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await resolveRelationalGrounding(
            'put sweeping tool on table',
            'sweeping tool',
            'table',
            catalog,
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result).toEqual({
            type: 'success',
            subjectId: broomId,
            targetId: tableId,
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).not.toHaveBeenCalled()
        expect(embedSpan).toHaveBeenCalledTimes(1)
    })

    it('dedupes span embed across subject and target when both miss exact match', async () => {
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbeddingFromAxis(0),
        })
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `{"objectId":"${broomId}"}`,
        })

        const result = await resolveRelationalGrounding(
            'put sweeping tool on sweeping tool',
            'sweeping tool',
            'Sweeping Tool',
            [{
                objectId: broomId,
                normalizedShortName: 'broom',
                embedding: makeEmbeddingFromAxis(1),
            }],
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.sameSubjectAndTarget,
        })
        expect(embedSpan).toHaveBeenCalledTimes(1)
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalledTimes(2)
    })

    it('falls through to identity LLM on embed invoke failure without terminal error', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `{"objectId":"${broomId}"}`,
        })
        const embedSpan = jest.fn().mockResolvedValue({ success: false })

        const result = await resolveRelationalGrounding(
            'put sweeping tool on table',
            'sweeping tool',
            'table',
            [
                {
                    objectId: broomId,
                    normalizedShortName: 'broom',
                    embedding: makeEmbeddingFromAxis(1),
                },
                { objectId: tableId, normalizedShortName: 'table' },
            ],
            { invokeBedrockObjectManipulationIdentityImpl, embedSpan }
        )

        expect(result).toEqual({
            type: 'success',
            subjectId: broomId,
            targetId: tableId,
        })
        expect(embedSpan).toHaveBeenCalledTimes(1)
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalledTimes(1)
    })
})
