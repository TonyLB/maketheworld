import { harnessRoomObjects } from './coyoteEngineTestFixtures'
import { buildHypothesisStageTwoPromptParts } from './buildHypothesisStageTwoPrompt'

describe('buildHypothesisStageTwoPromptParts', () => {
    it('includes topology, interpretation rules, seam labels, and combined clustering only', () => {
        const combined = `## Combined clustering

### Trap
- **stableKey:** anvil — **shortName:** anvil — **room:** VORTEX

## Outliers

(none)`

        const parts = buildHypothesisStageTwoPromptParts({
            roomObjectsByRoom: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
                'ROOM#STRAIGHTAWAY': [],
                'ROOM#CLIFFTOP': [],
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': [],
            },
            combinedMarkdown: combined,
        })
        expect(parts.invariantPrefix).toContain('## Extended reasoning vs visible assistant text')
        expect(parts.invariantPrefix).toContain('**extended reasoning**')
        expect(parts.invariantPrefix).toContain('## Combined clustering Markdown (how to read the dynamic tail)')
        expect(parts.invariantPrefix).toContain('**prep**')
        expect(parts.invariantPrefix).toContain('**creation**')
        expect(parts.invariantPrefix).toContain('**## Outliers**')
        expect(parts.invariantPrefix).toContain('**intendedRole**')
        expect(parts.invariantPrefix).toContain('**entity_modification**')
        expect(parts.invariantPrefix).toContain('## World topology')
        expect(parts.invariantPrefix).toContain('## Interpretation rules')
        expect(parts.invariantPrefix).toContain('## Temporal ordering (prep vs execution)')
        expect(parts.invariantPrefix).toContain('**Hypothesis:** sentence')
        expect(parts.invariantPrefix).toContain('## Combined clustering input (structured Markdown)')
        expect(parts.dynamicSuffix).toContain('## Seam room labels')
        expect(parts.dynamicSuffix).toContain('`ROOM#VORTEX` → **VORTEX**')
        expect(parts.dynamicSuffix).toContain(combined.trim())
        expect(parts.dynamicSuffix).not.toContain('## Current staged objects by room')
        expect(parts.invariantPrefix).not.toContain('## Seam Markdown contract')
    })
})
