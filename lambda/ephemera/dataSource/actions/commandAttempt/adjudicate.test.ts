import { CommandAttempt } from './index'
import { adjudicateAttempt, isCommandAttemptData } from './adjudicate'

describe('adjudicateAttempt', () => {
    it('leaves a challenge-free attempt succeeded (nothing to adjudicate)', () => {
        const attempt = CommandAttempt.fromJSON({
            words: 'take the broom',
            referents: [{ refKey: 'primaryObject', id: 'OBJECT#Broom', shortName: 'broom' }],
            actions: [{ kind: 'position', id: 'action-1', desiredResultDescription: 'Take: broom', challenges: [] }],
        })

        const result = adjudicateAttempt(attempt).result

        expect(result).toEqual({ status: 'succeeded', outcome: 'Take: broom' })
    })

    const ropeAttempt = (challenge: object) => CommandAttempt.fromJSON({
        words: 'take the rope',
        referents: [{ refKey: 'primaryObject', id: 'OBJECT#Rope', shortName: 'rope' }],
        actions: [
            { kind: 'position', id: 'action-2', desiredResultDescription: 'Take: rope', challenges: [] },
            {
                kind: 'position',
                id: 'action-3',
                desiredResultDescription: 'Dissolve: is lashed to',
                challenges: [challenge as never],
            },
        ],
    })

    const lashedChallenge = {
        kind: 'customEdge',
        id: 'challenge-1',
        edge: { from: 'OBJECT#Rope', to: 'OBJECT#Post', kind: 'Custom', relationLabel: 'is lashed to' },
        description: 'Boundary relation to dissolve: is lashed to.',
    }

    it('records met on a Custom-edge challenge, so row 6\'s rope is untied and taken', () => {
        const judged = adjudicateAttempt(ropeAttempt(lashedChallenge))

        expect(judged.actions()[1]?.challenges()[0]?.verdict?.kind).toBe('met')
        expect(judged.result).toEqual({ status: 'succeeded', outcome: 'Take: rope and Dissolve: is lashed to' })
    })

    it('leaves a world-knowledge challenge pending', () => {
        const judged = adjudicateAttempt(ropeAttempt({ kind: 'worldKnowledge', id: 'challenge-1', description: 'The rope is very heavy.' }))

        expect(judged.result).toEqual({ status: 'pending' })
    })

    it('does not overwrite a verdict already recorded', () => {
        const judged = adjudicateAttempt(ropeAttempt({ ...lashedChallenge, verdict: { kind: 'impossible', reason: 'no' } }))

        expect(judged.result).toEqual({ status: 'impossible', reason: 'no' })
    })
})

describe('isCommandAttemptData', () => {
    it('accepts a well-shaped CommandAttemptData', () => {
        expect(isCommandAttemptData({
            words: 'take the broom',
            referents: [{ refKey: 'primaryObject', id: 'OBJECT#Broom', shortName: 'broom' }],
            actions: [{ kind: 'position', id: 'action-4', challenges: [] }],
        })).toBe(true)
    })

    it('rejects a value missing required fields', () => {
        expect(isCommandAttemptData({ words: 'take the broom' })).toBe(false)
        expect(isCommandAttemptData(null)).toBe(false)
        expect(isCommandAttemptData(undefined)).toBe(false)
        expect(isCommandAttemptData({
            words: 'take the broom',
            referents: [],
            actions: [{ kind: 'position', id: 'action-5', challenges: [{ kind: 'customEdge', id: 'x', description: 'd' }] }],
        })).toBe(false)
        expect(isCommandAttemptData({
            words: 'take the broom',
            referents: [],
            actions: [{ kind: 'position', challenges: [] }],
        })).toBe(false)
    })
})
