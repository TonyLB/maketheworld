import type { CommandSelectOutcome } from '@tonylb/mtw-interfaces/ts/messages'

import type { ParseCommandConsultResult } from './baseClasses'
import type {
    PersistentCommandPayload,
    PersistentCommandPending,
    PersistentCommandRoot,
} from './persistentCommand/payload'
import type { TranscriptContext } from './persistentCommand/transcript'

/** A question for the player, as the row stores it and the bubble shows it. */
export type SelectQuestion = {
    root: PersistentCommandRoot
    pending: PersistentCommandPending
    outcome: CommandSelectOutcome
}

const SELECT_PROMPT = 'Which did you mean?'

const assignmentKey = (answers: Record<string, string>): string => (
    JSON.stringify(Object.entries(answers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
)

/**
 * A referent question for a Consult, or undefined when the Consult is not one (the caller keeps its
 * `Error` copy). It is one only when the result carries a frozen root and every alternative is a
 * distinct, non-empty joint assignment: a Consult that differs by plan over one assignment would
 * offer options that store the same answer.
 */
export const selectQuestionFromConsult = (
    result: ParseCommandConsultResult,
    mintOptionId: () => string
): SelectQuestion | undefined => {
    const { root, alternatives } = result
    if (!root || alternatives.length < 2) {
        return undefined
    }
    const assignments = alternatives.map(({ referentAnswers }) => referentAnswers)
    if (!assignments.every((answers): answers is NonNullable<typeof answers> => (
        answers !== undefined && Object.keys(answers).length > 0
    ))) {
        return undefined
    }
    if (new Set(assignments.map(assignmentKey)).size !== assignments.length) {
        return undefined
    }
    const options = alternatives.map((alternative, index) => ({
        optionId: mintOptionId(),
        label: alternative.label ?? alternative.proposedCommand,
        answers: { ...assignments[index] } as Record<string, string>,
    }))
    return {
        root,
        pending: {
            options: Object.fromEntries(options.map(({ optionId, answers }) => [optionId, answers])),
        },
        outcome: {
            Kind: 'Select',
            Message: [SELECT_PROMPT],
            Options: options.map(({ optionId, label }) => ({ OptionId: optionId, Label: [label] })),
        },
    }
}

/**
 * The row that stores a question. `prior` is the answers already given to this command, kept so a
 * second question never erases the first answer (only the open question lives in `pending`).
 */
export const askRowPayload = (
    question: SelectQuestion,
    transcript: TranscriptContext,
    prior: Pick<PersistentCommandPayload, 'referentAnswers' | 'challengeAnswers'> = { referentAnswers: {}, challengeAnswers: {} }
): PersistentCommandPayload => ({
    root: question.root,
    transcript: { messageId: transcript.messageId, createdTime: transcript.createdTime, command: transcript.command },
    pending: question.pending,
    referentAnswers: prior.referentAnswers,
    challengeAnswers: prior.challengeAnswers,
})
