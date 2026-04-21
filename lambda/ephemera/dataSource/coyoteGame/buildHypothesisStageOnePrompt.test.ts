import { harnessRoomObjects } from './coyoteEngineTestFixtures'
import { buildHypothesisStageOnePromptParts } from './buildHypothesisStageOnePrompt'
import { SNAPSHOT_SECTION_HEADER } from './coyoteHypothesisPromptShared'

describe('buildHypothesisStageOnePromptParts', () => {
    it('places topology and seam instructions before staged-object snapshot', () => {
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
        expect(full).toContain('## World topology')
        expect(full).toContain('## Seam room labels')
        expect(full).toContain('`ROOM#STRAIGHTAWAY` → **STRAIGHTAWAY**')
        expect(full).toContain('## Stage one JSON contract')
        expect(full).toContain('"role": "influence-road-runner"')
        expect(full).toContain('"role": "connect-props"')
        expect(full).toContain('"role": "delivery"')
        expect(full).toContain('Do not include legacy tuple keys such as **`target`** or **`mode`**')
        expect(full).toContain(SNAPSHOT_SECTION_HEADER)
        expect(full).toContain('STRAIGHTAWAY')
        expect(full).toContain('rocket skates')
        expect(full).not.toContain('## Interpretation rules')
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
    })
})
