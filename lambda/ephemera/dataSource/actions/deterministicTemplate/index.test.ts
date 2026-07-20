import { deterministicTemplateRegistry, matchDeterministicTemplate } from './index'

describe('matchDeterministicTemplate', () => {
    it('dispatches each bare word to its correct intent', () => {
        expect(matchDeterministicTemplate('look')).toMatchObject({ intent: { type: 'LookRoom' } })
        expect(matchDeterministicTemplate('l')).toMatchObject({ intent: { type: 'LookRoom' } })
        expect(matchDeterministicTemplate('help')).toMatchObject({ intent: { type: 'Help' } })
        expect(matchDeterministicTemplate('home')).toMatchObject({ intent: { type: 'Home' } })
        expect(matchDeterministicTemplate('predict')).toMatchObject({ intent: { type: 'PredictHypothesis' } })
    })

    it('returns noMatch for an unrecognized command', () => {
        expect(matchDeterministicTemplate('juggle flaming torches')).toEqual({ type: 'noMatch' })
    })

    it('is deterministic across repeated calls (first-match-wins registry order)', () => {
        expect(deterministicTemplateRegistry.length).toBe(14)
        expect(matchDeterministicTemplate('look')).toEqual(matchDeterministicTemplate('look'))
    })
})
