import { buildHypothesisPhasePlanHopPromptParts } from './buildHypothesisPhasePlanHopPromptParts'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'

describe('buildHypothesisPhasePlanHopPromptParts', () => {
    it('embeds hop-1 handoff and combined clustering', () => {
        const parts = buildHypothesisPhasePlanHopPromptParts({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            combinedMarkdown: '## Combined clustering\n### C\n- prop',
            hop1Handoff: {
                paragraphSummary: 'Summary line.',
                rubricIssues: ['gap a'],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Summary line.')
        expect(full).toContain('gap a')
        expect(full).toContain('```json')
        expect(full).toContain('## Combined clustering')
    })
})
