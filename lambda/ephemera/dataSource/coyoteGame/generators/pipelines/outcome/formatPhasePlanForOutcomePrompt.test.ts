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

        expect(text).toContain('Trope sequence: Contraption -> Finishing Move')
        expect(text).toContain('Deconfliction: Use skates for setup and reserve anvil for the finisher.')
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
        expect(text).toContain('Trope sequence: Contraption')
        expect(text).toContain('Deconfliction: Fallback unknown key example.')
        expect(text).toContain('Staged props: missing-key')
    })

    it('formats Bait and Misdirection in canonical trope order', () => {
        const text = formatPhasePlanForOutcomePrompt(
            {
                tropeSequence: ['Contraption', 'Bait', 'Misdirection', 'Finishing Move'],
                deconflictionSummary: 'Lure then misread terrain before terminal beat.',
                phases: [
                    {
                        trope: 'Contraption',
                        tropeBeat: 'Stage the illusion surface.',
                        stableKeysUsed: [],
                        virtualEntities: [],
                        achievement: 'Prep complete.',
                    },
                    {
                        trope: 'Bait',
                        tropeBeat: 'Birdseed draws the runner onto the path.',
                        stableKeysUsed: [],
                        virtualEntities: [],
                        achievement: 'Voluntary routing.',
                    },
                    {
                        trope: 'Misdirection',
                        tropeBeat: 'Runner treats wall tunnel as traversable.',
                        stableKeysUsed: [],
                        virtualEntities: [],
                        achievement: 'Misread at speed.',
                    },
                    {
                        trope: 'Finishing Move',
                        tropeBeat: 'Runner smashes into the wall at lethal speed.',
                        stableKeysUsed: [],
                        virtualEntities: [],
                        achievement: 'Backfire.',
                    },
                ],
            },
            { 'ROOM#VORTEX': [] },
        )

        expect(text).toContain(
            'Trope sequence: Contraption -> Bait -> Misdirection -> Finishing Move',
        )
        expect(text).toContain('Deconfliction: Lure then misread terrain before terminal beat.')
        expect(text).toContain('Phase 2: Bait — Birdseed draws the runner onto the path.')
        expect(text).toContain('Phase 3: Misdirection — Runner treats wall tunnel as traversable.')
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
