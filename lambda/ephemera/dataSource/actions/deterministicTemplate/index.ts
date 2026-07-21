import { awaitRoadRunnerTemplate, helpTemplate, homeTemplate, lookTemplate, predictTemplate } from './bareWordTemplates'
import { relationalTemplateRegistry } from './relationalTemplates'
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
    ...relationalTemplateRegistry,
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
 * bare-word/paraphrase subset only, deliberately excluding
 * relationalTemplateRegistry. Object-manipulation's relational dispatch
 * already runs its own live path (classifySkeletonFamily / matchRelationalTemplate
 * over a Parse-produced skeleton) -- wiring the relational DeterministicTemplate
 * entries in *addition* would mean two different mechanisms could both decide
 * `ObjectRelateIntent`, and consuming a relational match here would require
 * threading its synthesized skeleton into the same downstream enrich pipeline
 * runParseStage's output goes into (CPG-6's zero-Bedrock optimization) -- a
 * distinct, nontrivial change with its own test surface, not required to close
 * the Sub-iteration 1 Command regression this registry exists to close. Left
 * for a future slice; excluding the relational entries here by construction
 * (a separate registry, not a runtime type filter) keeps that scope boundary
 * visible in code, not just in comments. See
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
