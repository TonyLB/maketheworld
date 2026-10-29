import { CommandAttempt } from '../../commandAttempt'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { CustomEdgeChallenge, ExitEdgeChallenge } from '../../commandAttempt/challenge'
import { customEdgeStructuralChallengeId } from '../../commandAttempt/expandBoundaryChallenges'
import type { GroundedAttemptCandidate } from './attemptCandidates'
import { applyChallengeAnswers, primaryActionIdOf } from './resumeAnswers'

const candidateWithExitChallenge = (): GroundedAttemptCandidate => ({
    attempt: CommandAttempt.create('membership', 'take rope', [
        new PositionAttemptAction('primary', [new ExitEdgeChallenge('exitEdge:primary', 'touches an exit')], undefined, 'Take: rope'),
    ]),
    confidence: 1,
    alternative: { label: 'rope', proposedCommand: 'take the rope' },
})

const challengesOf = (candidate: GroundedAttemptCandidate) => candidate.attempt.actions().flatMap((action) => action.challenges())

describe('primaryActionIdOf', () => {
    it('is the last action\'s id', () => {
        const attempt = CommandAttempt.create('membership', 'x', [
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

describe('applyChallengeAnswers: a Custom edge that gained an edgeId (EM-2)', () => {
    const bare = { from: 'OBJECT#Rope', to: 'OBJECT#Post', kind: 'Custom', relationLabel: 'is lashed to' } as const
    const withId = { ...bare, edgeId: 'edge-1' } as const
    const candidateWithEdge = (edge: typeof bare | typeof withId): GroundedAttemptCandidate => ({
        attempt: CommandAttempt.create('membership', 'take rope', [
            new PositionAttemptAction('primary', [
                new CustomEdgeChallenge(
                    'edgeId' in edge ? 'customEdge:primary:edge-1' : customEdgeStructuralChallengeId('primary', edge),
                    edge,
                    'Boundary relation to dissolve: is lashed to.'
                ),
            ], undefined, 'Take: rope'),
        ]),
        confidence: 1,
        alternative: { label: 'rope', proposedCommand: 'take the rope' },
    })
    const structuralKey = customEdgeStructuralChallengeId('primary', bare)
    const met = { verdict: { kind: 'met' }, source: 'player' } as const
    const impossible = { verdict: { kind: 'impossible', reason: 'bolted' }, source: 'player' } as const

    it('matches an answer stored under the structural key, and keeps the canonical id', () => {
        const [applied] = applyChallengeAnswers([candidateWithEdge(withId)], { [structuralKey]: met })
        expect(challengesOf(applied!).map((challenge) => [challenge.id, challenge.verdict?.toJSON()])).toEqual([['customEdge:primary:edge-1', { kind: 'met' }]])
    })

    it('matches an answer stored under the id', () => {
        const [applied] = applyChallengeAnswers([candidateWithEdge(withId)], { 'customEdge:primary:edge-1': met })
        expect(challengesOf(applied!)[0]!.verdict?.toJSON()).toEqual({ kind: 'met' })
    })

    it('leaves an id-less edge keyed as before', () => {
        const [applied] = applyChallengeAnswers([candidateWithEdge(bare)], { [structuralKey]: met })
        expect(challengesOf(applied!)[0]!.id).toBe(structuralKey)
        expect(challengesOf(applied!)[0]!.verdict?.toJSON()).toEqual({ kind: 'met' })
    })

    it('still ignores a key no challenge matches', () => {
        const candidate = candidateWithEdge(withId)
        const [applied] = applyChallengeAnswers([candidate], { 'customEdge:primary:other': met })
        expect(applied).toBe(candidate)
    })

    it('prefers the canonical answer when both forms are stored', () => {
        const [applied] = applyChallengeAnswers([candidateWithEdge(withId)], { [structuralKey]: met, 'customEdge:primary:edge-1': impossible })
        expect(challengesOf(applied!)[0]!.verdict?.toJSON()).toEqual({ kind: 'impossible', reason: 'bolted' })
    })
})
