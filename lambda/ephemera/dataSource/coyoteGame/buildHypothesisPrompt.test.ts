import { buildHypothesisPrompt, buildHypothesisPromptParts } from './buildHypothesisPrompt'

describe('buildHypothesisPrompt', () => {
    it('places topology instructions before the live snapshot', () => {
        const prompt = buildHypothesisPrompt({
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': ['rocket skates'],
                'ROOM#VORTEX': ['anvil'],
                'ROOM#CLIFFTOP': ['giant magnet'],
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': ['portable hole'],
            },
        })

        expect(prompt).toContain('## World topology')
        expect(prompt).toContain('drop or release the boulder')
        expect(prompt).toContain('Road Runner to collide with the rock face')
        expect(prompt).toContain('Address the player in second person')
        expect(prompt).toContain('intellectually humble and provisional')
        expect(prompt).toContain('It looks like you are trying to')
        expect(prompt).toContain('single most plausible detailed plan')
        expect(prompt).toContain('Do not list multiple possible plans')
        expect(prompt).toContain('Do not use ambiguous either-or phrasing')
        expect(prompt).toContain('Good style: "Hypothesis: It looks like you are trying to use the roller skates')
        expect(prompt).toContain('Bad style: "Hypothesis: It seems like you are trying to set up a chase')
        expect(prompt).toContain('## Current staged objects by room')
        expect(prompt).toContain('STRAIGHTAWAY: rocket skates')
        expect(prompt).toContain('CLIFFTOP: giant magnet')
        expect(prompt.trim().endsWith('BRIDGE: portable hole')).toBe(true)
    })

    it('rejoins prompt parts to the same string as buildHypothesisPrompt', () => {
        const input = {
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': ['rocket skates'],
                'ROOM#VORTEX': ['anvil'],
            },
        }
        const full = buildHypothesisPrompt(input)
        const parts = buildHypothesisPromptParts(input)
        expect(parts.invariantPrefix + parts.dynamicSuffix).toBe(full)
    })
})
