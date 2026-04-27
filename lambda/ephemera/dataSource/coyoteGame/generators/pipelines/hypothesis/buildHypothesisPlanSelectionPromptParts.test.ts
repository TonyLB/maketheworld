import { buildHypothesisPlanSelectionPromptParts } from './buildHypothesisPlanSelectionPromptParts'
import { COYOTE_HOP1_HANDOFF_JSON_KEYS } from './coyoteHop1Handoff'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'

describe('buildHypothesisPlanSelectionPromptParts', () => {
    it('includes rubric dimensions, handoff key names, and combined clustering tail', () => {
        const parts = buildHypothesisPlanSelectionPromptParts({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            combinedMarkdown: '## Combined clustering\n### C\n- x',
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('coverage')
        expect(full).toContain('completeness')
        expect(full).toContain('coherence')
        expect(full).toContain(COYOTE_HOP1_HANDOFF_JSON_KEYS.paragraphSummary)
        expect(full).toContain(COYOTE_HOP1_HANDOFF_JSON_KEYS.rubricIssues)
        expect(full).toContain('## Combined clustering')
        expect(parts.dynamicSuffix).toContain('ROOM#VORTEX')
    })
})
