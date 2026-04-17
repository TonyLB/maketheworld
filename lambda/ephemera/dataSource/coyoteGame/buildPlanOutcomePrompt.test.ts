import { buildPlanOutcomePrompt, buildPlanOutcomePromptParts } from './buildPlanOutcomePrompt'

describe('buildPlanOutcomePrompt', () => {
    it('includes safety, backfire, hypothesis section, and staged objects', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': ['rocket skates'],
                'ROOM#VORTEX': ['anvil'],
            },
            hypothesisLine: 'Hypothesis: It looks like you are trying to test the road.',
        })

        expect(prompt).toContain('## World topology')
        expect(prompt).toContain('The Road Runner must not be harmed')
        expect(prompt).toContain('setback or punchline should land on the Coyote')
        expect(prompt).toContain('poetic, ironic')
        expect(prompt).toContain('## Current hypothesis about your intent')
        expect(prompt).toContain('Hypothesis: It looks like you are trying to test the road.')
        expect(prompt).toContain('## Current staged objects by room')
        expect(prompt).toContain('STRAIGHTAWAY: rocket skates')
        expect(prompt).toContain('VORTEX: anvil')
        expect(prompt).toContain('beginning exactly with "Outcome:"')
    })

    it('uses placeholder when hypothesis is blank', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': [] },
            hypothesisLine: '   ',
        })
        expect(prompt).toContain('## Current hypothesis about your intent')
        expect(prompt).toContain('(none)')
    })

    it('rejoins prompt parts to the same string as buildPlanOutcomePrompt', () => {
        const input = {
            roomObjectsByRoom: { 'ROOM#VORTEX': ['anvil'] },
            hypothesisLine: 'Hypothesis: test.',
        }
        const full = buildPlanOutcomePrompt(input)
        const parts = buildPlanOutcomePromptParts(input)
        expect(parts.invariantPrefix + parts.dynamicSuffix).toBe(full)
    })
})
