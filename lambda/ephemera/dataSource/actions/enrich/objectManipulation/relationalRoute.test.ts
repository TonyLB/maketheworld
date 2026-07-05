import type { ManipulationFrameBuildInput } from './manipulationFrame'
import { commandHasRelationalPreposition, evaluateRelationalRoute } from './relationalRoute'

function relationalInput(overrides: Partial<ManipulationFrameBuildInput> = {}): ManipulationFrameBuildInput {
    return {
        command: 'put the broom on the table',
        rawObjectSpans: ['broom'],
        verbClass: 'release',
        ...overrides,
    }
}

describe('commandHasRelationalPreposition', () => {
    it('blocks on word boundary', () => {
        expect(commandHasRelationalPreposition('put the broom on the table')).toBe(true)
    })

    it('blocks under word boundary', () => {
        expect(commandHasRelationalPreposition('stash it under the bench')).toBe(true)
    })

    it('blocks against and around for B1 fixtures', () => {
        expect(commandHasRelationalPreposition('lean rope against anvil')).toBe(true)
        expect(commandHasRelationalPreposition('tie cord around crate')).toBe(true)
    })

    it('blocks expanded prepositions', () => {
        expect(commandHasRelationalPreposition('slide it onto the shelf')).toBe(true)
        expect(commandHasRelationalPreposition('hang it over the hook')).toBe(true)
        expect(commandHasRelationalPreposition('hide beneath the rug')).toBe(true)
        expect(commandHasRelationalPreposition('set it beside the chair')).toBe(true)
    })

    it('blocks containment prepositions for nesting route', () => {
        expect(commandHasRelationalPreposition('put the coin in the jar')).toBe(true)
        expect(commandHasRelationalPreposition('stash it inside the chest')).toBe(true)
        expect(commandHasRelationalPreposition('pour water into the bowl')).toBe(true)
    })

    it('does not block onward or understand', () => {
        expect(commandHasRelationalPreposition('move onward')).toBe(false)
        expect(commandHasRelationalPreposition('move inward')).toBe(false)
        expect(commandHasRelationalPreposition('help me understand')).toBe(false)
    })

    it('does not block bare take or drop', () => {
        expect(commandHasRelationalPreposition('pick up the broom')).toBe(false)
        expect(commandHasRelationalPreposition('drop the broom')).toBe(false)
    })
})

describe('evaluateRelationalRoute', () => {
    it('routes relational commands with preposition cue', () => {
        expect(evaluateRelationalRoute(relationalInput())).toEqual({ type: 'relational' })
    })

    it('routes membership for single-span acquire without relational cue', () => {
        expect(evaluateRelationalRoute(relationalInput({
            command: 'pick up the broom',
            rawObjectSpans: ['broom'],
            verbClass: 'acquire',
        }))).toEqual({ type: 'membership' })
    })

    it('routes membership for multi-span without relational cue', () => {
        expect(evaluateRelationalRoute(relationalInput({
            command: 'pick up the broom and the anvil',
            rawObjectSpans: ['broom', 'anvil'],
            verbClass: 'acquire',
        }))).toEqual({ type: 'membership' })
    })

    it('routes relational for multi-span with relational cue', () => {
        expect(evaluateRelationalRoute(relationalInput({
            command: 'put the broom and rope on the table',
            rawObjectSpans: ['broom', 'rope'],
        }))).toEqual({ type: 'relational' })
    })
})
