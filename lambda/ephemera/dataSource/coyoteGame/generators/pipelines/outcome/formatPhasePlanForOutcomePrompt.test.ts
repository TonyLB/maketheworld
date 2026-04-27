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
                phases: [
                    {
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
                        stableKeysUsed: ['anvil-1'],
                        virtualEntities: [],
                        achievement: 'Drop fails upward.',
                        prepVsBeat: 'creation',
                    },
                ],
            },
            roomObjectsByRoom,
        )

        expect(text).toContain('Phase 1 — prep: Close the gap on the highway.')
        expect(text).toContain('Staged props: rocket skates (rocket-skates-0)')
        expect(text).toContain('Virtual "speed burst" (deployed): from rocket-skates-0')
        expect(text).toContain('Phase 2 — creation: Drop fails upward.')
        expect(text).toContain('Staged props: anvil (anvil-1)')
    })

    it('falls back to raw stableKey when not in snapshot', () => {
        const text = formatPhasePlanForOutcomePrompt(
            {
                phases: [
                    {
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
