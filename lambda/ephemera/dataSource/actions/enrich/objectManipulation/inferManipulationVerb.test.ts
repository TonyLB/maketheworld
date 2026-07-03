import { inferObjectManipulationVerb } from './inferManipulationVerb'

describe('inferObjectManipulationVerb', () => {
    it('classifies drop commands', () => {
        expect(inferObjectManipulationVerb('drop the broom')).toBe('drop')
        expect(inferObjectManipulationVerb('DROP the rope')).toBe('drop')
        expect(inferObjectManipulationVerb('put down the hammer')).toBe('drop')
        expect(inferObjectManipulationVerb('put the crate down')).toBe('drop')
    })

    it('classifies pick-up commands', () => {
        expect(inferObjectManipulationVerb('pick up the broom')).toBe('pickUp')
        expect(inferObjectManipulationVerb('take the crate')).toBe('pickUp')
        expect(inferObjectManipulationVerb('grab the rope')).toBe('pickUp')
        expect(inferObjectManipulationVerb('get the broom')).toBe('pickUp')
    })
})
