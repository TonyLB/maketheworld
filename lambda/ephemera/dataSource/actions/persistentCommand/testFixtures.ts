import { stampStableRefKeys } from '../enrich/objectManipulation/parse/stampStableRefKeys'
import { planSkeleton } from '../enrich/objectManipulation/plan/planSkeleton'
import type { PersistentCommandPayload } from './payload'

/** `take cup` waiting on a choice between two cups: no answers yet, two options. */
export const twoCupPendingPayload = (): PersistentCommandPayload => {
    const payload = takeCupPayload()
    const key = Object.keys(payload.referentAnswers)[0]!
    const { selectedAttempt, ...rest } = payload
    return {
        ...rest,
        referentAnswers: {},
        challengeAnswers: {},
        pending: {
            options: {
                'option-red': { [key]: 'OBJECT#RedCup' },
                'option-blue': { [key]: 'OBJECT#BlueCup' },
            },
        },
    }
}

/** A realistic payload: the frozen root is what Plan really returns for `take cup`. */
export const takeCupPayload = (): PersistentCommandPayload => {
    const command = 'take cup'
    const skeleton = stampStableRefKeys([
        { type: 'text', text: 'take' },
        { type: 'objectSpan', span: 'cup' },
    ])
    const { attempts } = planSkeleton(skeleton, command)
    return {
        root: { command, skeleton, attempts: attempts.map((attempt) => attempt.toJSON()), confidence: 0.9 },
        transcript: { messageId: 'MESSAGE#take-cup', createdTime: 1700000000000, command },
        selectedAttempt: attempts[0]!.actions()[0]!.id,
        referentAnswers: { [(skeleton[1] as { stableRefKey: string }).stableRefKey]: 'OBJECT#RedCup' },
        challengeAnswers: {
            'exitEdge:a': { verdict: { kind: 'met' }, source: 'process', askedAs: 'ask:exitEdge:a' },
            'customEdge:a:b': { verdict: { kind: 'impossible', reason: 'too tight' }, source: 'player' },
        },
    }
}
