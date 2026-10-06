import { awaitRoadRunnerTemplate, helpTemplate, homeTemplate, lookTemplate, predictTemplate } from './bareWordTemplates'
import type { DeterministicTemplate, DeterministicTemplateMatch } from './deterministicTemplate'

/**
 * Ordered, first-match-wins; agnostic to which factory produced each entry
 * (a future non-pattern-driven implementation could sit in this same array).
 */
export const deterministicTemplateRegistry: DeterministicTemplate[] = [
    lookTemplate,
    helpTemplate,
    homeTemplate,
    predictTemplate,
    awaitRoadRunnerTemplate,
]

export function matchDeterministicTemplate(command: string): DeterministicTemplateMatch {
    for (const template of deterministicTemplateRegistry) {
        const result = template.matchString(command)
        if (result.type !== 'noMatch') {
            return result
        }
    }
    return { type: 'noMatch' }
}

/**
 * Sub-iteration 2 (iteration 7, 2026-07-20) live-path entry point: the
 * bare-word/paraphrase subset only. There is no relational entry in this registry: peer relations
 * have no deterministic parse (the relational templates retired in AGENT.retireDeterministicRelationParsing,
 * slice 2), and object-manipulation's dispatch runs its own live path (planSkeleton over a
 * Parse-produced skeleton). Keeping this as a separate registry, not a runtime type filter, keeps
 * the scope boundary visible in code. See
 * taskPlanning/lambda/ephemera/dataSource/actions/AGENT.classifyPlanGeneralization.planning.md,
 * CPG-1/CPG-6.
 *
 * `lookTemplate` and `predictTemplate` are also deliberately excluded --
 * `look`/`l` are always intercepted upstream by deterministicChecks.ts's
 * pre-classify fast path, so a `Command`-routed input can never actually be
 * bare `look`, and `lookTemplate` carries no paraphrase lexicon (an explicit
 * scope call: open-ended `look` paraphrases like "peruse the room" are
 * LLM-fallback territory, not a closed deterministic list) -- so it would
 * never fire here even in principle. `predictTemplate` is excluded because
 * `PredictHypothesis` isn't one of the six families this registry closes the
 * regression for (paraphrase recognition for `predict` is classify's own LLM
 * prompt's job, Section C2 of buildIntentClassificationPrompt.ts).
 */
export const nonObjectManipulationTemplateRegistry: DeterministicTemplate[] = [
    helpTemplate,
    homeTemplate,
    awaitRoadRunnerTemplate,
]

export function matchNonObjectManipulationTemplate(command: string): DeterministicTemplateMatch {
    for (const template of nonObjectManipulationTemplateRegistry) {
        const result = template.matchString(command)
        if (result.type !== 'noMatch') {
            return result
        }
    }
    return { type: 'noMatch' }
}
