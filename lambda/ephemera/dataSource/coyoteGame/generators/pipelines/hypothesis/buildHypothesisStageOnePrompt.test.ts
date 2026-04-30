import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import { buildHypothesisStageOnePromptParts } from './buildHypothesisStageOnePrompt'

describe('buildHypothesisStageOnePromptParts', () => {
    it('includes stage-one contract anchors and dynamic seam/snapshot sections', () => {
        const parts = buildHypothesisStageOnePromptParts({
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket skates']),
                'ROOM#VORTEX': [],
                'ROOM#CLIFFTOP': [],
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': [],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        // Spot-check only: keep invariantPrefix checks intentionally minimal.
        // Update these for major contract shifts, but avoid adding new string
        // checkpoints by default when prompt wording changes.
        expect(parts.invariantPrefix).toContain('## World topology')
        expect(full).toContain('## Stage one JSON contract')
        expect(full).toContain('"tropeFunction":')
        expect(full).not.toContain('intendedRole')
        expect(parts.dynamicSuffix).toContain('## Seam room labels')
        expect(parts.dynamicSuffix).toContain('`ROOM#STRAIGHTAWAY` → **STRAIGHTAWAY**')
        expect(parts.dynamicSuffix).toContain('## Current staged objects by room')
        expect(parts.dynamicSuffix).toContain('Use this JSON as authoritative staged-object input')
        expect(parts.dynamicSuffix).toContain('```json')
        expect(parts.dynamicSuffix).toContain('"roomId": "ROOM#STRAIGHTAWAY"')
        expect(parts.dynamicSuffix).toContain('"shortName": "rocket skates"')
        expect(parts.dynamicSuffix).toContain('"stableKey": "rocket-skates-0"')
        expect(parts.dynamicSuffix).toContain('"tropeAffinities"')
    })

    it('rejoins parts consistently', () => {
        const input = {
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket']),
                'ROOM#VORTEX': [],
                'ROOM#CLIFFTOP': [],
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': [],
            },
        }
        const parts = buildHypothesisStageOnePromptParts(input)
        expect(parts.dynamicSuffix.startsWith('\n## Seam room labels')).toBe(true)
        expect(parts.dynamicSuffix).toContain('## Current staged objects by room')
        expect(parts.dynamicSuffix).toContain('```json')
    })
})
