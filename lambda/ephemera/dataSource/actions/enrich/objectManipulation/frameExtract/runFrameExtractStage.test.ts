import { runFrameExtractStage } from './runFrameExtractStage'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'

describe('runFrameExtractStage', () => {
    it('returns frame on successful Bedrock invoke and parse', async () => {
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on"}',
        })

        const result = await runFrameExtractStage(
            {
                command: 'put broom on table',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
            },
            { invokeBedrockObjectManipulationFrameExtractImpl }
        )

        expect(result).toEqual({
            type: 'success',
            frame: {
                command: 'put broom on table',
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
                verbClass: 'release',
                rawObjectSpans: ['broom'],
            },
        })
        expect(invokeBedrockObjectManipulationFrameExtractImpl).toHaveBeenCalled()
    })

    it('returns invoke failure error', async () => {
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: false,
        })

        const result = await runFrameExtractStage(
            {
                command: 'put broom on table',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
            },
            { invokeBedrockObjectManipulationFrameExtractImpl }
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.frameExtractInvokeFailed,
        })
    })

    it('returns parse failure error', async () => {
        const invokeBedrockObjectManipulationFrameExtractImpl = jest.fn().mockResolvedValue({
            success: true,
            body: 'not json',
        })

        const result = await runFrameExtractStage(
            {
                command: 'put broom on table',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
            },
            { invokeBedrockObjectManipulationFrameExtractImpl }
        )

        expect(result.type).toBe('error')
        if (result.type === 'error') {
            expect(result.errorMessage).toBe(objectManipulationErrorMessages.frameExtractParseFailed)
        }
    })
})
