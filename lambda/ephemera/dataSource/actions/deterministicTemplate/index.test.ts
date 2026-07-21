import {
    deterministicTemplateRegistry,
    matchDeterministicTemplate,
    matchNonObjectManipulationTemplate,
    nonObjectManipulationTemplateRegistry,
} from './index'

describe('matchDeterministicTemplate', () => {
    it('dispatches each bare word to its correct intent', () => {
        expect(matchDeterministicTemplate('look')).toMatchObject({ intent: { type: 'LookRoom' } })
        expect(matchDeterministicTemplate('l')).toMatchObject({ intent: { type: 'LookRoom' } })
        expect(matchDeterministicTemplate('help')).toMatchObject({ intent: { type: 'Help' } })
        expect(matchDeterministicTemplate('home')).toMatchObject({ intent: { type: 'Home' } })
        expect(matchDeterministicTemplate('predict')).toMatchObject({ intent: { type: 'PredictHypothesis' } })
        expect(matchDeterministicTemplate('wait')).toMatchObject({ intent: { type: 'AwaitRoadRunner' } })
    })

    it('returns noMatch for an unrecognized command', () => {
        expect(matchDeterministicTemplate('juggle flaming torches')).toEqual({ type: 'noMatch' })
    })

    it('is deterministic across repeated calls (first-match-wins registry order)', () => {
        expect(deterministicTemplateRegistry.length).toBe(15)
        expect(matchDeterministicTemplate('look')).toEqual(matchDeterministicTemplate('look'))
    })
})

describe('matchNonObjectManipulationTemplate', () => {
    it('dispatches the zero-referent family subset only (Sub-iteration 2)', () => {
        expect(matchNonObjectManipulationTemplate('help me')).toMatchObject({ intent: { type: 'Help' } })
        expect(matchNonObjectManipulationTemplate('go home')).toMatchObject({ intent: { type: 'Home' } })
        expect(matchNonObjectManipulationTemplate('wait for the bird')).toMatchObject({ intent: { type: 'AwaitRoadRunner' } })
    })

    it('excludes look, predict, and relational entries by construction', () => {
        expect(nonObjectManipulationTemplateRegistry.length).toBe(3)
        // "look"/"l" are always intercepted upstream by deterministicChecks.ts's pre-classify
        // fast path, so this registry never needs to recognize them; look also carries no
        // paraphrase lexicon (deliberate scope call, LLM-fallback territory).
        expect(matchNonObjectManipulationTemplate('look')).toEqual({ type: 'noMatch' })
        expect(matchNonObjectManipulationTemplate('peruse the room')).toEqual({ type: 'noMatch' })
        expect(matchNonObjectManipulationTemplate('predict')).toEqual({ type: 'noMatch' })
        expect(matchNonObjectManipulationTemplate('put lamp on table')).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for an unrecognized command', () => {
        expect(matchNonObjectManipulationTemplate('juggle flaming torches')).toEqual({ type: 'noMatch' })
    })
})
