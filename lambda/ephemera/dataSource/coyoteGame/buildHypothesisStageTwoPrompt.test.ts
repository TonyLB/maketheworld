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
        expect(parts.invariantPrefix).toContain('## Scene analysis and fenced Hypothesis (assistant text only)')
        expect(parts.invariantPrefix).toContain('Do not rely on a separate Nova reasoning channel')
        expect(parts.invariantPrefix).toContain('final** ```text fence')
        expect(parts.invariantPrefix).toContain('## Combined clustering Markdown (how to read the dynamic tail)')
        expect(parts.invariantPrefix).toContain('**prep**')
        expect(parts.invariantPrefix).toContain('**creation**')
        expect(parts.invariantPrefix).toContain('**## Outliers**')
        expect(parts.invariantPrefix).toContain('**intendedRole**')
        expect(parts.invariantPrefix).toContain('**influence-road-runner**')
        expect(parts.invariantPrefix).toContain('**alter-road-runner**')
        expect(parts.invariantPrefix).toContain('**coyote-equipment**')
        expect(parts.invariantPrefix).toContain('**coyote-enhancement**')
        expect(parts.invariantPrefix).toContain('**setting-addition**')
        expect(parts.invariantPrefix).toContain('**connect-props**')
        expect(parts.invariantPrefix).toContain('**enhance-prop**')
        expect(parts.invariantPrefix).toContain('intent-level semantics')
        expect(parts.invariantPrefix).toContain('Never reinterpret Road Runner roles as Coyote gear-building instructions')
        expect(parts.invariantPrefix).not.toContain('entity_modification')
        expect(parts.invariantPrefix).not.toContain('**`target`**')
        expect(parts.invariantPrefix).not.toContain('**`mode`**')
        expect(parts.invariantPrefix).toContain('## World topology')
        expect(parts.invariantPrefix).toContain('## Interpretation rules')
        expect(parts.invariantPrefix).toContain('## Temporal ordering (prep vs execution)')
        expect(parts.invariantPrefix).toContain('## Virtual scenery and prep-invented props')
        expect(parts.invariantPrefix).toContain('**Environmental scenery**')
        expect(parts.invariantPrefix).toContain('painted fake tunnel')
        expect(parts.invariantPrefix).toContain('**Hypothesis:** sentence')
        expect(parts.invariantPrefix).toContain('## Combined clustering input (structured Markdown)')
        expect(parts.dynamicSuffix).toContain('## Seam room labels')
        expect(parts.dynamicSuffix).toContain('`ROOM#VORTEX` → **VORTEX**')
        expect(parts.dynamicSuffix).toContain(combined.trim())
        expect(parts.dynamicSuffix).not.toContain('## Current staged objects by room')
        expect(parts.invariantPrefix).not.toContain('## Seam Markdown contract')
    })
})
