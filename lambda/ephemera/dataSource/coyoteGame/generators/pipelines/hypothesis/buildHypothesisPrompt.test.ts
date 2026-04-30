import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import { buildHypothesisPrompt, buildHypothesisPromptParts } from './buildHypothesisPrompt'

describe('buildHypothesisPrompt', () => {
    it('includes stable instruction anchors and staged objects in dynamic tail', () => {
        const prompt = buildHypothesisPrompt({
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket skates']),
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
                'ROOM#CLIFFTOP': harnessRoomObjects('clifftop', ['giant magnet']),
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': harnessRoomObjects('bridge', ['portable hole']),
            },
        })

        // Spot-check only: keep invariant prompt assertions sparse.
        // Adjust these when high-level prompt framing changes, but do not
        // grow this list for routine copy tweaks.
        expect(prompt).toContain('## World topology')
        expect(prompt).toContain('## Current staged objects by room')
        expect(prompt).toContain('STRAIGHTAWAY')
        expect(prompt).toContain('rocket skates')
        expect(prompt).toContain('CLIFFTOP')
        expect(prompt).toContain('giant magnet')
        expect(prompt).toContain('BRIDGE')
        expect(prompt).toContain('portable hole')
        expect(prompt).toContain('anvil — stableKey: anvil-0')
    })

    it('rejoins prompt parts to the same string as buildHypothesisPrompt', () => {
        const input = {
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket skates']),
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
            },
        }
        const full = buildHypothesisPrompt(input)
        const parts = buildHypothesisPromptParts(input)
        expect(parts.invariantPrefix + parts.dynamicSuffix).toBe(full)
        expect(parts.dynamicSuffix.startsWith('\n\n## Current staged objects by room')).toBe(true)
        expect(parts.dynamicSuffix).toContain('STRAIGHTAWAY')
        expect(parts.dynamicSuffix).toContain('rocket skates')
        expect(parts.dynamicSuffix).toContain('CLIFFBASE')
        expect(parts.dynamicSuffix).toContain('anvil')
    })
})
