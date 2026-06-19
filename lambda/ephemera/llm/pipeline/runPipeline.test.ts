import { createPipelineContext, defineLlmInvokeStep } from '.';
import type { InvokeBedrockConverseTextParams, InvokeBedrockConverseTextResult } from '../invokeBedrockConverseText';

type TraceState = Record<string, unknown> & {
    trace: string;
    counter: number;
};

describe('runPipeline', () => {
    it('runs steps in order so each step sees prior committed state', async () => {
        const ctx = createPipelineContext<TraceState>();
        const steps = [
            ctx.defineOrchestrationStep({
                name: 'first',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: `${String(state.trace)}a`,
                            counter: Number(state.counter) + 1,
                        },
                    }),
            }),
            ctx.defineOrchestrationStep({
                name: 'second',
                run: (state) => {
                    expect(state.trace).toBe('a');
                    expect(state.counter).toBe(1);
                    return Promise.resolve({
                        state: {
                            ...state,
                            trace: `${String(state.trace)}b`,
                        },
                    });
                },
            }),
        ];

        const r = await ctx.runPipeline({ trace: '', counter: 0 }, steps);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.state.trace).toBe('ab');
            expect(r.state.counter).toBe(1);
        }
    });

    it('propagates unexpected throw with last committed state only', async () => {
        const ctx = createPipelineContext<TraceState>();
        const steps = [
            ctx.defineOrchestrationStep({
                name: 'ok',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: 'before-boom',
                        },
                    }),
            }),
            ctx.defineOrchestrationStep({
                name: 'boom',
                run: () => {
                    throw new Error('step failed');
                },
            }),
            ctx.defineOrchestrationStep({
                name: 'skipped',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: 'should-not-run',
                        },
                    }),
            }),
        ];

        const r = await ctx.runPipeline({ trace: '', counter: 0 }, steps);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.failedStepName).toBe('boom');
            expect(r.failedStepIndex).toBe(1);
            expect(r.abort).toBe(false);
            expect(r.state.trace).toBe('before-boom');
            expect(r.error).toEqual(new Error('step failed'));
        }
    });

    it('stops on abort discriminant with partial returned state', async () => {
        const ctx = createPipelineContext<TraceState>();
        const steps = [
            ctx.defineOrchestrationStep({
                name: 'ok',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: 'committed',
                        },
                    }),
            }),
            ctx.defineOrchestrationStep({
                name: 'abort-step',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: 'partial-abort',
                            counter: 99,
                        },
                        abort: true,
                    }),
            }),
            ctx.defineOrchestrationStep({
                name: 'skipped',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: 'should-not-run',
                        },
                    }),
            }),
        ];

        const r = await ctx.runPipeline({ trace: '', counter: 0 }, steps);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.abort).toBe(true);
            expect(r.failedStepName).toBe('abort-step');
            expect(r.failedStepIndex).toBe(1);
            expect(r.state.trace).toBe('partial-abort');
            expect(r.state.counter).toBe(99);
            expect(r.error).toBeUndefined();
        }
    });

    it('invokes telemetry hooks with step names and indices', async () => {
        const starts: string[] = [];
        const ends: string[] = [];

        const ctx = createPipelineContext<TraceState>();
        const steps = [
            ctx.defineOrchestrationStep({
                name: 'alpha',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: 'x',
                        },
                    }),
            }),
            ctx.defineOrchestrationStep({
                name: 'beta',
                run: (state) =>
                    Promise.resolve({
                        state: {
                            ...state,
                            trace: `${String(state.trace)}y`,
                        },
                    }),
            }),
        ];

        const r = await ctx.runPipeline(
            { trace: '', counter: 0 },
            steps,
            {
                onStepStart: (name, index) => {
                    starts.push(`${name}:${index}`);
                },
                onStepEnd: (name, index) => {
                    ends.push(`${name}:${index}`);
                },
            }
        );

        expect(r.ok).toBe(true);
        expect(starts).toEqual(['alpha:0', 'beta:1']);
        expect(ends).toEqual(['alpha:0', 'beta:1']);
    });

    it('supports async work inside a step before returning next state', async () => {
        type AsyncState = Record<string, unknown> & { ready: boolean };
        const ctx = createPipelineContext<AsyncState>();
        const steps = [
            ctx.defineOrchestrationStep({
                name: 'async-step',
                run: async (state) => {
                    await Promise.resolve();
                    return {
                        state: {
                            ...state,
                            ready: true,
                        },
                    };
                },
            }),
        ];

        const r = await ctx.runPipeline({ ready: false }, steps);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.state.ready).toBe(true);
        }
    });
});

describe('defineLlmInvokeStep', () => {
    it('writes outputs and meta on success', async () => {
        type LlmState = Record<string, unknown> & {
            out?: string;
            meta?: { ok: boolean; modelId: string; latencyMs: number };
        };

        const params: InvokeBedrockConverseTextParams = {
            modelId: 'test.model',
            messages: [{ role: 'user', content: [{ text: 'hi' }] }],
            maxTokens: 100,
            temperature: 0,
            timeoutMs: 5000,
        };

        const invoke = jest.fn(
            (): Promise<InvokeBedrockConverseTextResult> =>
                Promise.resolve({
                    success: true,
                    body: '{"x":1}',
                })
        );

        const ctx = createPipelineContext<LlmState>();
        const step = ctx.defineLlmStep(
            defineLlmInvokeStep<LlmState>({
                name: 'llm',
                buildParams: () => params,
                invoke,
                applyOutputs: (state, { body }) => ({
                    ...state,
                    out: body,
                }),
                applyMeta: (state, meta) => ({
                    ...state,
                    meta,
                }),
            })
        );

        const r = await ctx.runPipeline({}, [step]);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.state.out).toBe('{"x":1}');
            expect(r.state.meta?.ok).toBe(true);
            expect(r.state.meta?.modelId).toBe('test.model');
            expect(typeof r.state.meta?.latencyMs).toBe('number');
        }
        expect(invoke).toHaveBeenCalledWith(params);
    });

    it('fails invoke with last committed state unchanged on throw', async () => {
        type LlmState = Record<string, unknown> & {
            meta?: { ok: boolean; errorMessage?: string };
        };

        const invoke = jest.fn(
            (): Promise<InvokeBedrockConverseTextResult> =>
                Promise.resolve({
                    success: false,
                    errorMessage: 'rate limited',
                })
        );

        const ctx = createPipelineContext<LlmState>();
        const step = ctx.defineLlmStep(
            defineLlmInvokeStep<LlmState>({
                name: 'llm-fail',
                buildParams: () => ({
                    modelId: 'm',
                    messages: [],
                    maxTokens: 1,
                    temperature: 0,
                    timeoutMs: 1,
                }),
                invoke,
                applyOutputs: (state) => state,
                applyMeta: (state, meta) => ({
                    ...state,
                    meta,
                }),
            })
        );

        const r = await ctx.runPipeline({}, [step]);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.failedStepName).toBe('llm-fail');
            expect(r.abort).toBe(false);
            expect(r.state).toEqual({});
            expect(r.error).toEqual(new Error('rate limited'));
        }
    });
});
