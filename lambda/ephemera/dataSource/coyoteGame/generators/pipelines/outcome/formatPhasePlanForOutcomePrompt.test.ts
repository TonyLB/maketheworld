import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import {
    formatPhasePlanForOutcomePrompt,
    buildStableKeyToShortNameMap,
} from './formatPhasePlanForOutcomePrompt'

describe('formatPhasePlanForOutcomePrompt', () => {
    it('formats beats with resolved shortNames from derivedFrom', () => {
        const roomObjectsByRoom = {
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['rocket skates', 'anvil']),
        }
        const text = formatPhasePlanForOutcomePrompt(
            {
                beats: [
                    {
                        beatId: 'prep',
                        description: 'Build speed before the strike.',
                        derivedFrom: ['rocket-skates-0'],
                    },
                    {
                        beatId: 'finish',
                        description: 'Drop the anvil when lane commitment is locked.',
                        derivedFrom: ['anvil-1'],
                    },
                ],
                linearizedSequence: ['prep', 'finish'],
            },
            roomObjectsByRoom,
        )

        expect(text).toContain('Linearized sequence: prep -> finish')
        expect(text).toContain('Beat 1: prep')
        expect(text).toContain('Description: Build speed before the strike.')
        expect(text).toContain('Grounded from: rocket skates (rocket-skates-0)')
        expect(text).toContain('Beat 2: finish')
        expect(text).toContain('Description: Drop the anvil when lane commitment is locked.')
        expect(text).toContain('Grounded from: anvil (anvil-1)')
    })

    it('labels materialized affordance stableKeys distinctly from staged props', () => {
        const text = formatPhasePlanForOutcomePrompt(
            {
                beats: [
                    {
                        beatId: 'finish',
                        description: 'Cartoon finish.',
                        derivedFrom: ['affordance-coyote', 'anvil-0'],
                    },
                ],
                linearizedSequence: ['finish'],
            },
            {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
            },
        )
        expect(text).toContain(
            'Grounded from: coyote (materialized affordance: affordance-coyote), anvil (anvil-0)',
        )
    })

    it('falls back to raw stableKey when not in snapshot', () => {
        const text = formatPhasePlanForOutcomePrompt(
            {
                beats: [
                    {
                        beatId: 'unknown',
                        description: 'Use unknown prop.',
                        derivedFrom: ['missing-key'],
                    },
                ],
                linearizedSequence: ['unknown'],
            },
            { 'ROOM#VORTEX': [] },
        )
        expect(text).toContain('Linearized sequence: unknown')
        expect(text).toContain('Grounded from: missing-key')
    })

    it('formats multiple beats in array order (linearized sequence drives header)', () => {
        const text = formatPhasePlanForOutcomePrompt(
            {
                beats: [
                    {
                        beatId: 'contraption',
                        description: 'Stage the illusion surface.',
                        derivedFrom: [],
                    },
                    {
                        beatId: 'bait',
                        description: 'Birdseed draws the runner onto the path.',
                        derivedFrom: [],
                    },
                    {
                        beatId: 'misdirection',
                        description: 'Runner treats wall tunnel as traversable.',
                        derivedFrom: [],
                    },
                    {
                        beatId: 'finishing',
                        description: 'Runner smashes into the wall at lethal speed.',
                        derivedFrom: [],
                    },
                ],
                linearizedSequence: ['contraption', 'bait', 'misdirection', 'finishing'],
            },
            { 'ROOM#VORTEX': [] },
        )

        expect(text).toContain(
            'Linearized sequence: contraption -> bait -> misdirection -> finishing',
        )
        expect(text).toContain('Beat 2: bait')
        expect(text).toContain('Description: Birdseed draws the runner onto the path.')
        expect(text).toContain('Beat 3: misdirection')
        expect(text).toContain('Description: Runner treats wall tunnel as traversable.')
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
