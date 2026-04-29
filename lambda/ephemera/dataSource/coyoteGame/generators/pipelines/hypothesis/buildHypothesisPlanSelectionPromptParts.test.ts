import { buildHypothesisPlanSelectionPromptParts } from './buildHypothesisPlanSelectionPromptParts'
import { COYOTE_HOP1_HANDOFF_JSON_KEYS } from './coyoteHop1Handoff'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'

describe('buildHypothesisPlanSelectionPromptParts', () => {
    it('includes rubric dimensions, handoff keys, trope candidates JSON tail, and seam rooms', () => {
        const parts = buildHypothesisPlanSelectionPromptParts({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            combined: {
                candidates: [
                    {
                        candidateId: 'candidate-1',
                        executionSummary: 'One-line summary.',
                        tropeAssignments: [
                            {
                                trope: 'Contraption',
                                executionDetail: 'Beat detail.',
                                members: [
                                    {
                                        identifier: 'anvil-0',
                                        tropeFunction: 'terminal payload',
                                    },
                                ],
                            },
                        ],
                        outliers: [],
                    },
                ],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('coverage')
        expect(full).toContain('completeness')
        expect(full).toContain('coherence')
        expect(full).toContain(COYOTE_HOP1_HANDOFF_JSON_KEYS.paragraphSummary)
        expect(full).toContain(COYOTE_HOP1_HANDOFF_JSON_KEYS.rubricIssues)
        expect(full).toContain('## Intent conflicts')
        expect(full).toContain('## Rubric comparison')
        expect(full).toContain('## Winner selection')
        expect(full).toContain('```json')
        expect(full).toContain('"schemaVersion":1')
        expect(full).toContain('"candidateId":"candidate-1"')
        expect(parts.dynamicSuffix).toContain('ROOM#VORTEX')
        expect(full).toContain('## Trope candidates (input JSON)')
    })
})
