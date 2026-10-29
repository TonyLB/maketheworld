import { CommandAttempt } from '../../commandAttempt'
import { CustomEdgeChallenge, WorldKnowledgeChallenge } from '../../commandAttempt/challenge'
import { customEdgeStructuralChallengeId } from '../../commandAttempt/expandBoundaryChallenges'
import { verdictFromJSON } from '../../commandAttempt/verdict'
import type { ChallengeAnswer } from '../../persistentCommand/payload'

import type { ViewAnswer } from '../../objectViews'
import type { GroundedAttemptCandidate } from './attemptCandidates'

/**
 * The answers a resumed command carries (a stored row's `selectedAttempt`, `referentAnswers` and
 * `challengeAnswers`), applied by `compileAttemptsFromSkeleton` at the points each one narrows.
 */
export type ResumeAnswers = {
    selectedAttempt?: string
    referentAnswers?: Readonly<Record<string, string>>
    viewAnswers?: Readonly<Record<string, ViewAnswer>>
    challengeAnswers?: Readonly<Record<string, ChallengeAnswer>>
}

export const resumeErrorMessages = {
    staleSelectedAttempt: 'Resume failed: the chosen plan is no longer one of the command\'s plans',
    staleReferentAnswer: (span: string): string => `Resume failed: the object chosen for "${span}" is no longer available`,
} as const

/** An attempt's identity across reruns of a frozen root: its primary (last) action's Plan-minted id. */
export const primaryActionIdOf = (attempt: CommandAttempt): string | undefined => {
    const actions = attempt.actions()
    return actions[actions.length - 1]?.id
}

/**
 * Re-keys `answers` by the canonical ids of `attempt`'s challenges: an answer under the structural
 * alias of an id-bearing Custom edge moves to the edge's id. When both forms are stored for one
 * challenge, the canonical one wins. Any other key passes through unchanged.
 */
const canonicalAnswerKeys = (
    attempt: CommandAttempt,
    answers: Readonly<Record<string, ChallengeAnswer>>
): Record<string, ChallengeAnswer> => {
    const primaryActionId = primaryActionIdOf(attempt)
    const aliases = new Map<string, string>()
    if (primaryActionId !== undefined) {
        attempt.actions().forEach((action) => action.challenges().forEach((challenge) => {
            if (challenge instanceof CustomEdgeChallenge && challenge.edge.kind === 'Custom' && challenge.edge.edgeId !== undefined) {
                aliases.set(customEdgeStructuralChallengeId(primaryActionId, challenge.edge), challenge.id)
            }
        }))
    }
    const entries = Object.entries(answers)
    return Object.fromEntries([
        ...entries.filter(([key]) => aliases.has(key)).map(([key, answer]) => [aliases.get(key)!, answer] as const),
        ...entries.filter(([key]) => !aliases.has(key)),
    ])
}

/**
 * Records each stored challenge answer as that challenge's verdict, directly (the answer is already
 * a verdict, so nothing goes back through Adjudicate). A stored key the fresh run did not regenerate
 * is ignored: the world changed and that question no longer arises. An answer carrying `askedAs`
 * re-adds its pending question challenge on the answered challenge's action, so the question is
 * asked again whether or not a nondeterministic judge would ask.
 *
 * A Custom edge's challenge is keyed by its `edgeId` once it has one, so an answer stored under its
 * structural key (before the id was assigned) is matched to it through that alias, then recorded
 * under the canonical id. The alias is derived from the live edge on each run, never stored.
 */
export const applyChallengeAnswers = (
    candidates: readonly GroundedAttemptCandidate[],
    answers: Readonly<Record<string, ChallengeAnswer>>
): GroundedAttemptCandidate[] => candidates.map((candidate) => {
    const attempt = Object.entries(canonicalAnswerKeys(candidate.attempt, answers)).reduce((current, [challengeId, answer]) => {
        const owner = current.actions().find((action) => action.challenges().some((challenge) => challenge.id === challengeId))
        if (owner === undefined) {
            return current
        }
        const judged = current.recordVerdict(challengeId, verdictFromJSON(answer.verdict))
        const askedAs = answer.askedAs
        if (askedAs === undefined) {
            return judged
        }
        const asked = owner.challenges().find((challenge) => challenge.id === challengeId)!
        return CommandAttempt.create(
            judged.kind,
            judged.words,
            judged.actions().map((action) => (action.id === owner.id
                ? action.withChallenges([
                    ...action.challenges().filter((challenge) => challenge.id !== askedAs),
                    new WorldKnowledgeChallenge(askedAs, asked.describe()),
                ])
                : action)),
            judged.narrationUnits()
        )
    }, candidate.attempt)
    return attempt === candidate.attempt ? candidate : { ...candidate, attempt }
})
