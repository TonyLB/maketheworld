import type { ExecutorOutputStep } from './synthesize/executorTypes'

export type DryRunVerdict = 'legal' | 'defer' | 'illegal'

/** `ExecutorOutcome`'s legal arm shape (`synthesize/executor.ts`), carried out of the dry run. */
export type ValidatedPlan = {
    steps: readonly ExecutorOutputStep[]
}

export type DryRunOutcome = {
    verdict: DryRunVerdict
    /** False when an LLM validator would be required (Custom / unmodeled). */
    decidable: boolean
    reason?: string
    /**
     * The validated, fully expanded plan the executor produced, when a `legal` verdict came from
     * the shared dry run (`attemptDryRun`). Absent for any non-`legal` verdict.
     */
    plan?: ValidatedPlan
}
