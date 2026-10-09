import { CommandAttempt } from '../../commandAttempt'
import { WorldKnowledgeChallenge } from '../../commandAttempt/challenge'
import { verdictFromJSON } from '../../commandAttempt/verdict'
import type { ChallengeAnswer } from '../../persistentCommand/payload'

import type { GroundedAttemptCandidate } from './attemptCandidates'

/**
 * The answers a resumed command carries (a stored row's `selectedAttempt`, `referentAnswers` and
 * `challengeAnswers`), applied by `compileAttemptsFromSkeleton` at the points each one narrows.
 */
export type ResumeAnswers = {
    selectedAttempt?: string
    referentAnswers?: Readonly<Record<string, string>>
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
 * Records each stored challenge answer as that challenge's verdict, directly (the answer is already
 * a verdict, so nothing goes back through Adjudicate). A stored key the fresh run did not regenerate
 * is ignored: the world changed and that question no longer arises. An answer carrying `askedAs`
 * re-adds its pending question challenge on the answered challenge's action, so the question is
 * asked again whether or not a nondeterministic judge would ask.
 */
export const applyChallengeAnswers = (
    candidates: readonly GroundedAttemptCandidate[],
    answers: Readonly<Record<string, ChallengeAnswer>>
): GroundedAttemptCandidate[] => candidates.map((candidate) => {
    const attempt = Object.entries(answers).reduce((current, [challengeId, answer]) => {
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
