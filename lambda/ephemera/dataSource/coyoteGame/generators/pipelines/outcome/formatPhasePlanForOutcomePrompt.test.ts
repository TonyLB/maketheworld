import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import {
    formatPhasePlanForOutcomePrompt,
    buildStableKeyToShortNameMap,
} from './formatPhasePlanForOutcomePrompt'

describe('formatPhasePlanForOutcomePrompt', () => {
    it('formats phases with resolved shortNames and virtual entities', () => {
        const roomObjectsByRoom = {
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['rocket skates', 'anvil']),
        }
        const text = formatPhasePlanForOutcomePrompt(
            {
                tropeSequence: ['Contraption', 'Finishing Move'],
                deconflictionSummary: 'Use skates for setup and reserve anvil for the finisher.',
                phases: [
                    {
                        trope: 'Contraption',
                        tropeBeat: 'Build speed before the strike.',
                        stableKeysUsed: ['rocket-skates-0'],
                        virtualEntities: [
                            {
                                label: 'speed burst',
                                derivedFrom: ['rocket-skates-0'],
                                phaseKind: 'deployed',
                            },
                        ],
                        achievement: 'Close the gap on the highway.',
                        prepVsBeat: 'prep',
                    },
                    {
                        trope: 'Finishing Move',
                        tropeBeat: 'Drop the anvil when lane commitment is locked.',
                        stableKeysUsed: ['anvil-1'],
                        virtualEntities: [],
                        achievement: 'Drop fails upward.',
                        prepVsBeat: 'creation',
                    },
                ],
            },
            roomObjectsByRoom,
        )

        expect(text).toContain('Phase 1 — prep: Contraption — Build speed before the strike.')
        expect(text).toContain('Achievement: Close the gap on the highway.')
        expect(text).toContain('Staged props: rocket skates (rocket-skates-0)')
        expect(text).toContain('Virtual "speed burst" (deployed): from rocket-skates-0')
        expect(text).toContain('Phase 2 — creation: Finishing Move — Drop the anvil when lane commitment is locked.')
        expect(text).toContain('Achievement: Drop fails upward.')
        expect(text).toContain('Staged props: anvil (anvil-1)')
    })

    it('falls back to raw stableKey when not in snapshot', () => {
        const text = formatPhasePlanForOutcomePrompt(
            {
                tropeSequence: ['Contraption'],
                deconflictionSummary: 'Fallback unknown key example.',
                phases: [
                    {
                        trope: 'Contraption',
                        tropeBeat: 'Use unknown prop.',
                        stableKeysUsed: ['missing-key'],
                        virtualEntities: [],
                        achievement: 'Unknown prop beat.',
                    },
                ],
            },
            { 'ROOM#VORTEX': [] },
        )
        expect(text).toContain('Staged props: missing-key')
    })
})

describe('buildStableKeyToShortNameMap', () => {
    it('indexes normalized keys across rooms', () => {
        const map = buildStableKeyToShortNameMap({
            'ROOM#A': harnessRoomObjects('a', ['x']),
            'ROOM#B': harnessRoomObjects('b', ['y']),
        })
        expect(map.size).toBeGreaterThanOrEqual(2)
    })
})
