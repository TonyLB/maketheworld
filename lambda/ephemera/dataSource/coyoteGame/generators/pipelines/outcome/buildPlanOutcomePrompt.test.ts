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
        expect(prompt).toContain('VORTEX')
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
            phasePlan: {
                tropeSequence: ['Contraption'],
                deconflictionSummary: 'Single setup lane.',
                phases: [
                    {
                        trope: 'Contraption',
                        tropeBeat: 'Prepare anvil drop.',
                        stableKeysUsed: ['anvil'],
                        virtualEntities: [],
                        achievement: 'Test.',
                    },
                ],
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

    it('includes phase plan outline when phasePlan is present', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
            },
            hypothesisLine: 'Hypothesis: Drop.',
            phasePlan: {
                tropeSequence: ['Finishing Move'],
                deconflictionSummary: 'Use anvil only at terminal beat.',
                phases: [
                    {
                        trope: 'Finishing Move',
                        tropeBeat: 'Drop anvil from committed lane.',
                        stableKeysUsed: ['anvil'],
                        virtualEntities: [],
                        achievement: 'Gravity votes coyote.',
                    },
                ],
            },
        })
        expect(prompt).toContain('## Phase plan (execution outline)')
        expect(prompt).toContain('Phase 1: Finishing Move — Drop anvil from committed lane.')
        expect(prompt).toContain('Achievement: Gravity votes coyote.')
        expect(prompt).toContain('Staged props: anvil')
        expect(prompt).toContain('single Outcome: line')
    })

    it('omits scene analysis and phase sections when absent', () => {
        const prompt = buildPlanOutcomePrompt({
            roomObjectsByRoom: baseRooms,
            hypothesisLine: 'Hypothesis: Minimal.',
        })
        expect(prompt).not.toContain('## Scene analysis')
        expect(prompt).not.toContain('## Phase plan (execution outline)')
    })
})
