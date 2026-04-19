import { harnessRoomObjects } from './coyoteEngineTestFixtures'
import { buildHypothesisStageTwoPromptParts } from './buildHypothesisStageTwoPrompt'
import { SNAPSHOT_SECTION_HEADER } from './coyoteHypothesisPromptShared'

describe('buildHypothesisStageTwoPromptParts', () => {
    it('includes topology, interpretation rules, seam and snapshot in suffix', () => {
        const seam = `## Objects\n\n### VORTEX · anvil\n- **Function:** x.\n- **Affinity:** coyoteOperated\n\n## Clusters\n\n### One\n- **Members:** VORTEX · anvil\n- **Coyote role:** participant\n- **Summary:** y.`
        const parts = buildHypothesisStageTwoPromptParts({
            roomObjectsByRoom: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
                'ROOM#STRAIGHTAWAY': [],
                'ROOM#CLIFFTOP': [],
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': [],
            },
            seamMarkdown: seam,
        })
        expect(parts.invariantPrefix).toContain('## World topology')
        expect(parts.invariantPrefix).toContain('## Interpretation rules')
        expect(parts.invariantPrefix).toContain('## Stage 1 seam (structured Markdown)')
        expect(parts.dynamicSuffix).toContain('## Seam room labels')
        expect(parts.dynamicSuffix).toContain('`ROOM#VORTEX` → **VORTEX**')
        expect(parts.dynamicSuffix).toContain(seam.trim())
        expect(parts.dynamicSuffix).toContain(SNAPSHOT_SECTION_HEADER)
        expect(parts.dynamicSuffix).toContain('VORTEX')
        expect(parts.dynamicSuffix).toContain('anvil')
        expect(parts.invariantPrefix).not.toContain('## Seam Markdown contract')
    })
})
