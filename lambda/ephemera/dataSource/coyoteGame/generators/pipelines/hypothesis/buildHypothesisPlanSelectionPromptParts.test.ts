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
        expect(full).toContain(COYOTE_HOP1_HANDOFF_JSON_KEYS.planIssues)
        expect(full).toContain('Code semantics for v1')
        expect(full).toContain('are intent-signal evidence that should count against the winner')
        expect(full).toContain('are underspecification')
        expect(full).toContain('not automatic winner disqualifiers')
        expect(full).toContain('## Intent conflicts')
        expect(full).toContain('## Rubric comparison')
        expect(full).toContain('## Winner selection')
        expect(full).toContain('## Internal phase order (single invocation; structured internals)')
        expect(full).toContain('### Phase 1 - candidate audit (internal mini-schema)')
        expect(full).toContain('### Phase 2 - rubric judgment (internal mini-schema)')
        expect(full).toContain('### Phase 3 - winner merge and residual issues (internal mini-schema)')
        expect(full).toContain('### Phase 4 - final handoff emission')
        expect(full).toContain('The only downstream-consumed artifact is the final trailing handoff `json` fence.')
        expect(full).toContain('`candidateAudit`')
        expect(full).toContain('`rubricJudgment`')
        expect(full).toContain('`winnerMerge`')
        expect(full).toContain('```json')
        expect(full).toContain('"schemaVersion":1')
        expect(full).toContain('"candidateId":"candidate-1"')
        expect(parts.dynamicSuffix).toContain('ROOM#VORTEX')
        expect(full).toContain('## Trope candidates (input JSON)')
    })

    it('keeps prompt content unchanged when staged trope environmentAffordances are present', () => {
        const parts = buildHypothesisPlanSelectionPromptParts({
            roomObjectsByRoom: {
                'ROOM#VORTEX': [{
                    uuid: 'OBJECT#anvil' as `OBJECT#${string}`,
                    shortName: 'anvil',
                    stableKey: 'anvil',
                    tropeAffinities: [{
                        trope: 'Finishing Move',
                        aptness: 'High',
                        narrowing: 'terminal payload',
                        environmentAffordances: ['drop-ready'],
                    }],
                }],
            },
            combined: {
                candidates: [{
                    candidateId: 'candidate-1',
                    executionSummary: 'One-line summary.',
                    tropeAssignments: [{
                        trope: 'Contraption',
                        executionDetail: 'Beat detail.',
                        members: [{ identifier: 'anvil', tropeFunction: 'terminal payload' }],
                    }],
                    outliers: [],
                }],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('"candidateId":"candidate-1"')
        expect(full).toContain('"stableKey":"anvil"')
        expect(full).not.toContain('drop-ready')
    })
})
