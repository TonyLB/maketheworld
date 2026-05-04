import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import { buildPlanOutcomePrompt, buildPlanOutcomePromptParts } from './buildPlanOutcomePrompt'

describe('buildPlanOutcomePrompt', () => {
    const baseRooms = {
        'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket skates']),
        'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
    }

    it('includes safety, backfire, hypothesis section, and staged objects', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: baseRooms,
            hypothesisLine: 'Hypothesis: It looks like you are trying to test the road.',
        })

        expect(prompt).toContain('## World topology')
        expect(prompt).toContain('The Road Runner must not be harmed')
        expect(prompt).toContain('setback or punchline should land on the Coyote')
        expect(prompt).toContain('poetic, ironic')
        expect(prompt).toContain('## Hypothesis line')
        expect(prompt).toContain('Hypothesis: It looks like you are trying to test the road.')
        expect(prompt).toContain('## Current staged objects by room')
        expect(prompt).toContain('STRAIGHTAWAY')
        expect(prompt).toContain('rocket skates')
        expect(prompt).toContain('CLIFFBASE')
        expect(prompt).toContain('anvil')
        expect(prompt).toContain('beginning exactly with "Outcome:"')
    })

    it('uses placeholder when hypothesis is blank', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': [] },
            hypothesisLine: '   ',
        })
        expect(prompt).toContain('## Hypothesis line')
        expect(prompt).toContain('(none)')
    })

    it('rejoins prompt parts to the same string as buildPlanOutcomePrompt', () => {
        const input = {
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            hypothesisLine: 'Hypothesis: test.',
        }
        const full = buildPlanOutcomePrompt(input)
        const parts = buildPlanOutcomePromptParts(input)
        expect(parts.invariantPrefix + parts.dynamicSuffix).toBe(full)
    })

    it('uses the same invariant prefix when only dynamic inputs change', () => {
        const minimal = buildPlanOutcomePromptParts({
            roomObjectsByRoom: { 'ROOM#VORTEX': [] },
            hypothesisLine: 'Hypothesis: A.',
        })
        const rich = buildPlanOutcomePromptParts({
            roomObjectsByRoom: baseRooms,
            hypothesisLine: 'Hypothesis: B.',
            walkthrough: 'You stage the chase along the highway.',
            narrativeBeatsStructured: {
                beats: [
                    {
                        beatId: 'prep',
                        description: 'Prepare anvil drop.',
                        derivedFrom: ['anvil'],
                    },
                ],
                linearizedSequence: ['prep'],
            },
        })
        expect(minimal.invariantPrefix).toBe(rich.invariantPrefix)
        expect(minimal.dynamicSuffix).not.toBe(rich.dynamicSuffix)
    })

    it('includes scene analysis when walkthrough is present', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': [] },
            hypothesisLine: 'Hypothesis: Trap.',
            walkthrough: 'The bird loops past the cliff.',
        })
        expect(prompt).toContain('## Scene analysis')
        expect(prompt).toContain('The bird loops past the cliff.')
        expect(prompt).toContain('cartoon time')
    })

    it('includes narrative beats outline when narrativeBeatsStructured is present', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
            },
            hypothesisLine: 'Hypothesis: Drop.',
            narrativeBeatsStructured: {
                beats: [
                    {
                        beatId: 'finish',
                        description: 'Drop anvil from committed lane.',
                        derivedFrom: ['anvil'],
                    },
                ],
                linearizedSequence: ['finish'],
            },
        })
        expect(prompt).toContain('## Narrative beats structured (execution outline)')
        expect(prompt).toContain('Linearized sequence: finish')
        expect(prompt).toContain('Beat 1: finish')
        expect(prompt).toContain('Description: Drop anvil from committed lane.')
        expect(prompt).toContain('Grounded from: anvil')
        expect(prompt).toContain('single Outcome: line')
    })

    it('keeps outcome prompt content unchanged when trope environmentAffordances are present', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: {
                'ROOM#VORTEX': [{
                    uuid: 'OBJECT#anvil' as `OBJECT#${string}`,
                    shortName: 'anvil',
                    stableKey: 'anvil',
                    tropeAffinities: [{
                        trope: 'Finishing Move',
                        aptness: 'High',
                        narrowing: 'terminal payload',
                        environmentAffordances: [{ object: 'boulder', roles: ['Contraption'] }],
                    }],
                }],
            },
            hypothesisLine: 'Hypothesis: Drop.',
        })
        expect(prompt).toContain('anvil — stableKey: anvil — tropes: Finishing Move High (terminal payload)')
        expect(prompt).not.toContain('drop-ready')
    })

    it('anchors instructions to trope order and walkthrough beats when both are present', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
            },
            hypothesisLine: 'Hypothesis: Follow the beat order.',
            walkthrough: 'First prep the lane, then commit the final drop.',
            narrativeBeatsStructured: {
                beats: [
                    {
                        beatId: 'prep',
                        description: 'Prime launch rail.',
                        derivedFrom: ['anvil'],
                    },
                    {
                        beatId: 'finish',
                        description: 'Release final payload.',
                        derivedFrom: ['anvil'],
                    },
                ],
                linearizedSequence: ['prep', 'finish'],
            },
        })
        expect(prompt).toContain('## Scene analysis')
        expect(prompt).toContain('First prep the lane, then commit the final drop.')
        expect(prompt).toContain('Linearized sequence: prep -> finish')
        expect(prompt).toContain('Follow')
        expect(prompt).toContain('linearized beat order and walkthrough beats')
    })

    it('omits scene analysis and phase sections when absent', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: baseRooms,
            hypothesisLine: 'Hypothesis: Minimal.',
        })
        expect(prompt).not.toContain('## Scene analysis')
        expect(prompt).not.toContain('## Narrative beats structured (execution outline)')
    })
})
