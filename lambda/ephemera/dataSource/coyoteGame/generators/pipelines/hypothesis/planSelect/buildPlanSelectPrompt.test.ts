import { buildPlanSelectPrompt } from './buildPlanSelectPrompt'
import { PLAN_SELECT_OUTPUT_JSON_KEYS } from './parsePlanSelectOutput'
import { harnessRoomObjects } from '../../../testHarness/coyoteEngineTestFixtures'

describe('buildPlanSelectPrompt', () => {
    it('uses single-candidate two-phase workflow with stable handoff requirements', () => {
        const parts = buildPlanSelectPrompt({
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
        expect(full).toContain(PLAN_SELECT_OUTPUT_JSON_KEYS.paragraphSummary)
        expect(full).toContain(PLAN_SELECT_OUTPUT_JSON_KEYS.planIssues)
        expect(full).toContain(PLAN_SELECT_OUTPUT_JSON_KEYS.selectedCandidate)
        expect(full).toContain('Treat this field as required')
        expect(full).toContain('output for this prompt run; do not omit it unless generating it is impossible.')
        expect(full).toContain('Code semantics for v1')
        expect(full).toContain('are intent-signal evidence that should count against the winner')
        expect(full).toContain('are underspecification')
        expect(full).toContain('not automatic winner disqualifiers')
        expect(full).toContain('## Intent conflicts')
        expect(full).toContain('## Rubric comparison')
        expect(full).toContain('## Winner selection')
        expect(full).toContain('## Internal phase order (single invocation; structured internals)')
        expect(full).toContain('### Phase 1 - issue surfacing for the sole candidate (internal mini-schema)')
        expect(full).toContain('### Phase 2 - candidate enhancement and final handoff emission')
        expect(full).toContain('There is no candidate-to-candidate')
        expect(full).toContain('competition in this run.')
        expect(full).toContain('Keep it non-comparative and grounded only in')
        expect(full).not.toContain('### Phase 2 - rubric judgment (internal mini-schema)')
        expect(full).not.toContain('### Phase 3 - winner merge and residual issues (internal mini-schema)')
        expect(full).not.toContain('### Phase 4 - final handoff emission')
        expect(full).toContain('The only downstream-consumed artifact is the final trailing handoff `json` fence.')
        expect(full).toContain('Include `selectedCandidate` in the final handoff JSON as a full copy of the winning candidate row')
        expect(full).toContain('`singleCandidateIssueAudit`')
        expect(full).toContain('`singleCandidateDelivery`')
        expect(full).toContain('```json')
        expect(full).toContain('"schemaVersion":2')
        expect(full).toContain('"candidateId":"candidate-1"')
        expect(parts.dynamicSuffix).toContain('ROOM#VORTEX')
        expect(full).toContain('## Trope candidates (input JSON)')
    })

    it('keeps multi-candidate rubric-comparison phase scaffolding', () => {
        const parts = buildPlanSelectPrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil', 'rope']) },
            combined: {
                candidates: [
                    {
                        candidateId: 'candidate-1',
                        executionSummary: 'One-line summary.',
                        tropeAssignments: [{
                            trope: 'Contraption',
                            executionDetail: 'Beat detail.',
                            members: [{ identifier: 'anvil-0', tropeFunction: 'terminal payload' }],
                        }],
                        outliers: [],
                    },
                    {
                        candidateId: 'candidate-2',
                        executionSummary: 'Another summary.',
                        tropeAssignments: [{
                            trope: 'Contraption',
                            executionDetail: 'Alternate beat detail.',
                            members: [{ identifier: 'rope-0', tropeFunction: 'trigger pull' }],
                        }],
                        outliers: [],
                    },
                ],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('Compare **all listed candidates** under **coverage**, **completeness**, and **coherence**')
        expect(full).toContain('### Phase 2 - rubric judgment (internal mini-schema)')
        expect(full).toContain('### Phase 3 - winner merge and residual issues (internal mini-schema)')
        expect(full).toContain('### Phase 4 - final handoff emission')
        expect(full).not.toContain('There is no candidate-to-candidate')
        expect(full).not.toContain('competition in this run.')
    })

    it('keeps prompt content unchanged when staged trope environmentAffordances are present', () => {
        const parts = buildPlanSelectPrompt({
            roomObjectsByRoom: {
                'ROOM#VORTEX': [{
                    uuid: 'OBJECT#anvil' as `OBJECT#${string}`,
                    shortName: 'anvil',
                    stableKey: 'anvil',
                    tropeAffinities: [{
                        trope: 'Finishing Move',
                        aptness: 'High',
                        narrowing: 'terminal payload',
                        environmentAffordances: [{ object: 'long-fall', roles: ['Finishing Move'] }],
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
