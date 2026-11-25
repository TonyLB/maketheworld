//
// Which registered pieces are not yet on the target platform, by the parts each lacks (calibration AGENT.md, "The platform's holdouts"): a
// leaf module. The platform is the structure, never one piece's settings on its axes.
//
/**
 * The platform's parts: the explicit render as the piece's default; the plan read through its view; and the change language, its reply
 * merged into the plan with no `concern`.
 */
export const PLATFORM_PARTS = ['explicit render', 'plan read', 'change language'] as const
export type PlatformPart = typeof PLATFORM_PARTS[number]

/**
 * The parts each piece lacks, by registry name (`family/stage` for a family's stage). It only shrinks: `platform.test.ts` computes every
 * piece's parts, and fails on a part a piece lacks that isn't listed, on a listed part the piece now has, and on a name not registered. A
 * piece takes the explicit render at its next redraft, as a draft of its own with a parity batch, and its default flips once its kept draft
 * runs explicit (the user, 2026-11-18). For a judge, `change language` says only that nothing it replies merges: whether a given judge
 * should write to the plan is its own move's question.
 */
export const PLATFORM_HOLDOUTS: Readonly<Record<string, readonly PlatformPart[]>> = {
    ruleCell: ['explicit render', 'plan read', 'change language'],
    nonRuleCell: ['explicit render', 'plan read', 'change language'],
    stepConsiderations: ['explicit render', 'plan read', 'change language'],
    'trial/against': ['explicit render', 'plan read', 'change language'],
    'trial/rebuttal': ['explicit render', 'plan read', 'change language'],
    'trial/verdict': ['explicit render', 'plan read', 'change language'],
    'trial/ruling': ['plan read', 'change language'],
    // It still writes `concern`.
    consequences: ['change language'],
}

/** The pieces the list doesn't cover: `sceneReading`, a probe of the render itself, which names its render in every payload and has nothing to plan. */
export const PLATFORM_EXEMPT: readonly string[] = ['sceneReading']
