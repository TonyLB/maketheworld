import { CommandAttempt } from './index'
import { adjudicateAttempt, isCommandAttemptData } from './adjudicate'

describe('adjudicateAttempt', () => {
    it('leaves a challenge-free attempt succeeded (nothing to adjudicate)', () => {
        const attempt = CommandAttempt.fromJSON({
            words: 'take the broom',
            referents: [{ refKey: 'primaryObject', id: 'OBJECT#Broom', shortName: 'broom' }],
            actions: [{ kind: 'position', desiredResultDescription: 'Take: broom', challenges: [] }],
        })

        const result = adjudicateAttempt(attempt).result

        expect(result).toEqual({ status: 'succeeded', outcome: 'Take: broom' })
    })

    it('leaves an attempt with an unresolved graph challenge pending --- matching today\'s silent defer', () => {
        const attempt = CommandAttempt.fromJSON({
            words: 'take the rope',
            referents: [{ refKey: 'primaryObject', id: 'OBJECT#Rope', shortName: 'rope' }],
            actions: [
                { kind: 'position', desiredResultDescription: 'Take: rope', challenges: [] },
                {
                    kind: 'position',
                    desiredResultDescription: 'Dissolve: is lashed to',
                    challenges: [
                        {
                            kind: 'customEdge',
                            id: 'challenge-1',
                            edge: { from: 'OBJECT#Rope', to: 'OBJECT#Post', kind: 'Custom', relationLabel: 'is lashed to' },
                            description: 'Boundary relation to dissolve: is lashed to.',
                        },
                    ],
                },
            ],
        })

        const result = adjudicateAttempt(attempt).result

        expect(result).toEqual({ status: 'pending' })
    })
})

describe('isCommandAttemptData', () => {
    it('accepts a well-shaped CommandAttemptData', () => {
        expect(isCommandAttemptData({
            words: 'take the broom',
            referents: [{ refKey: 'primaryObject', id: 'OBJECT#Broom', shortName: 'broom' }],
            actions: [{ kind: 'position', challenges: [] }],
        })).toBe(true)
    })

    it('rejects a value missing required fields', () => {
        expect(isCommandAttemptData({ words: 'take the broom' })).toBe(false)
        expect(isCommandAttemptData(null)).toBe(false)
        expect(isCommandAttemptData(undefined)).toBe(false)
        expect(isCommandAttemptData({
            words: 'take the broom',
            referents: [],
            actions: [{ kind: 'position', challenges: [{ kind: 'customEdge', id: 'x', description: 'd' }] }],
        })).toBe(false)
    })
})
