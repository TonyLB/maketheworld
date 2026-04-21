import {
    CoyoteHypothesisPipelineAbortError,
    mapPipelineRunToGenerateHypothesisResult,
} from './coyoteHypothesisPipeline';

describe('mapPipelineRunToGenerateHypothesisResult', () => {
    it('maps abort failure with stage results to stub pipeline result', () => {
        const result = mapPipelineRunToGenerateHypothesisResult({
            ok: false,
            state: {
                stageOneResult: { success: false, errorMessage: 'Throttled' },
                stageTwoResult: null,
            },
            failedStepName: 'hypothesisStageOneLlm',
            failedStepIndex: 1,
            error: new CoyoteHypothesisPipelineAbortError(),
        });
        expect(result).toEqual({
            record: { intent: 'Hypothesis: Stubbed' },
            stageOneResult: { success: false, errorMessage: 'Throttled' },
            stageTwoResult: null,
        });
    });

    it('rethrows when failure is not an intentional abort', () => {
        expect(() =>
            mapPipelineRunToGenerateHypothesisResult({
                ok: false,
                state: {},
                failedStepName: 'loadRoomObjects',
                failedStepIndex: 0,
                error: new Error('network'),
            })
        ).toThrow('network');
    });

    it('maps successful run state to pipeline result', () => {
        const result = mapPipelineRunToGenerateHypothesisResult({
            ok: true,
            state: {
                stageOneResult: {
                    success: true,
                    body: '{}',
                    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                },
                stageTwoResult: {
                    success: true,
                    body: 'Hypothesis: Test.',
                    usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
                },
                record: { intent: 'Hypothesis: Test.' },
            },
        });
        expect(result).toEqual({
            record: { intent: 'Hypothesis: Test.' },
            stageOneResult: expect.objectContaining({ success: true }),
            stageTwoResult: expect.objectContaining({ success: true }),
        });
    });
});
