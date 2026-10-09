import { CommandAttempt } from '../../commandAttempt'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { ExitEdgeChallenge } from '../../commandAttempt/challenge'
import type { GroundedAttemptCandidate } from './attemptCandidates'
import { applyChallengeAnswers, primaryActionIdOf } from './resumeAnswers'

const candidateWithExitChallenge = (): GroundedAttemptCandidate => ({
    attempt: CommandAttempt.create('take rope', [
        new PositionAttemptAction('primary', [new ExitEdgeChallenge('exitEdge:primary', 'touches an exit')], undefined, 'Take: rope'),
    ]),
    confidence: 1,
    alternative: { label: 'rope', proposedCommand: 'take the rope' },
})

const challengesOf = (candidate: GroundedAttemptCandidate) => candidate.attempt.actions().flatMap((action) => action.challenges())

describe('primaryActionIdOf', () => {
    it('is the last action\'s id', () => {
        const attempt = CommandAttempt.create('x', [
            new PositionAttemptAction('first', [], undefined, ''),
            new PositionAttemptAction('last', [], undefined, ''),
        ])
        expect(primaryActionIdOf(attempt)).toBe('last')
    })
})

describe('applyChallengeAnswers', () => {
    it('records a stored verdict on the challenge with that id', () => {
        const [applied] = applyChallengeAnswers([candidateWithExitChallenge()], {
            'exitEdge:primary': { verdict: { kind: 'impossible', reason: 'bolted' }, source: 'player' },
        })
        expect(challengesOf(applied!)[0]!.verdict?.toJSON()).toEqual({ kind: 'impossible', reason: 'bolted' })
        expect(applied!.attempt.result).toEqual({ status: 'impossible', reason: 'bolted' })
    })

    it('ignores a key no challenge carries, and returns the candidate untouched', () => {
        const candidate = candidateWithExitChallenge()
        const [applied] = applyChallengeAnswers([candidate], { 'exitEdge:other': { verdict: { kind: 'met' }, source: 'player' } })
        expect(applied).toBe(candidate)
    })

    it('re-adds the asked question as a pending challenge beside the answered one', () => {
        const [applied] = applyChallengeAnswers([candidateWithExitChallenge()], {
            'exitEdge:primary': { verdict: { kind: 'met' }, source: 'process', askedAs: 'ask:exitEdge:primary' },
        })
        const challenges = challengesOf(applied!)
        expect(challenges.map((challenge) => challenge.id)).toEqual(['exitEdge:primary', 'ask:exitEdge:primary'])
        expect(challenges[1]!.verdict).toBeUndefined()
        expect(applied!.attempt.result).toEqual({ status: 'pending' })
    })
})
