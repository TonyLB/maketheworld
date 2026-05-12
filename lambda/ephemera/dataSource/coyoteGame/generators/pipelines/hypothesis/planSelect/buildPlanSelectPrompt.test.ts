import { buildPlanSelectPrompt } from './buildPlanSelectPrompt'
import {
    MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX,
    PLAN_SELECT_OUTPUT_JSON_KEYS,
} from './parsePlanSelectOutput'
import { harnessRoomObjects } from '../../../testHarness/coyoteEngineTestFixtures'

describe('buildPlanSelectPrompt', () => {
    it('uses single-candidate cleanup-first four-phase workflow with stable handoff requirements', () => {
        const parts = buildPlanSelectPrompt({
            roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
            combined: {
                candidates: [
                    {
                        candidateId: 'candidate-1',
                        gimmick: 'deliver damage',
                        executionSummary: 'One-line summary.',
                        tropeAssignments: {
                            Contraption: {
                                executionDetail: 'Beat detail.',
                                members: [
                                    {
                                        identifier: 'anvil-0',
                                        tropeFunction: 'terminal payload',
                                    },
                                ],
                            },
                        },
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
        expect(full).toContain(PLAN_SELECT_OUTPUT_JSON_KEYS.remainingPlanIssues)
        expect(full).toContain(PLAN_SELECT_OUTPUT_JSON_KEYS.selectedCandidate)
        expect(full).toContain('Treat **`selectedCandidate`** as required output')
        expect(full).toContain('output for this prompt run; do not omit it unless generating it is impossible.')
        expect(full).toContain('non-array object keyed by trope')
        expect(full).toContain('Code semantics for v1')
        expect(full).toContain('are intent-signal evidence that should count against the winner')
        expect(full).toContain('are underspecification')
        expect(full).toContain('not automatic winner disqualifiers')
        expect(full).toContain('## Materialized candidates (Phase 1)')
        expect(full).toContain('{ "materializedCandidates": [ ... ] }')
        expect(full).toContain('cleanup trace')
        expect(full).toContain('## Intent conflicts')
        expect(full).toContain('## Rubric comparison')
        expect(full).toContain('## Winner selection')
        expect(full).toContain('## Internal phase order (single invocation; structured internals)')
        expect(full).toContain('### Phase 1 - cleanup: materialized candidate set (internal mini-schema)')
        expect(full).toContain('`materializedCandidates`')
        expect(full).toContain('Per-issue cleanup process (sequential; mutual exclusivity)')
        expect(full).toContain('Postcondition self-check (before Phase 2; backstop)')
        expect(full).toContain('MISSING_FINISHING_MOVE')
        expect(full).toContain('no double penalty')
        expect(full).toContain('**Cleanup first (internal):** follow Phase 1 to build **`materializedCandidates`**')
        expect(full).toContain('**sole** input `candidates[]` row')
        expect(full).toContain('### Phase 2 - rubric judgment (internal mini-schema)')
        expect(full).toContain('### Phase 3 - winner merge and residual issues (internal mini-schema)')
        expect(full).toContain('`winnerCandidateId` must equal** the sole input **`candidateId`**')
        expect(full).toContain('### Phase 4 - final handoff emission')
        expect(full).toContain('There is no candidate-to-candidate')
        expect(full).toContain('competition in this run.')
        expect(full).toContain('Keep it non-comparative and grounded only in')
        expect(full).toContain('The only **pipeline-consumed** artifact is the **final** trailing handoff **` ```json `** fence')
        expect(full).toContain('**sole** input row. That materialized row exists **only inside this response**')
        expect(full).toContain(
            'Include `selectedCandidate` in the final handoff JSON anchored on the winning input candidate row'
        )
        expect(full).toContain(MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX)
        expect(full).not.toContain('full copy')
        expect(full).not.toContain('complete copy')
        expect(full).toContain('`rubricJudgment`')
        expect(full).toContain('`winnerMerge`')
        expect(full).toContain('```json')
        expect(full).toContain('Schema version 4')
        expect(full).toContain('"schemaVersion":4')
        expect(full).toContain('**`gimmick`**')
        expect(full).toContain('reasoning alignment')
        expect(full).toContain('affordancesProvided')
        expect(full).toContain('environmentAffordances')
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
                        gimmick: 'deliver damage',
                        executionSummary: 'One-line summary.',
                        tropeAssignments: {
                            Contraption: {
                                executionDetail: 'Beat detail.',
                                members: [{ identifier: 'anvil-0', tropeFunction: 'terminal payload' }],
                            },
                        },
                        outliers: [],
                    },
                    {
                        candidateId: 'candidate-2',
                        gimmick: 'booby-trap',
                        executionSummary: 'Another summary.',
                        tropeAssignments: {
                            Contraption: {
                                executionDetail: 'Alternate beat detail.',
                                members: [{ identifier: 'rope-0', tropeFunction: 'trigger pull' }],
                            },
                        },
                        outliers: [],
                    },
                ],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('## Materialized candidates (Phase 1)')
        expect(full).toContain('## JSON fences (critical)')
        expect(full).toContain('Compare **all listed candidates** under **coverage**, **completeness**, and **coherence**')
        expect(full).toContain('**Cleanup first (internal):** follow Phase 1 to build **`materializedCandidates`**')
        expect(full).toContain('### Phase 1 - cleanup: materialized candidate set (internal mini-schema)')
        expect(full).toContain('`materializedCandidates`')
        expect(full).toContain('Per-issue cleanup process (sequential; mutual exclusivity)')
        expect(full).toContain('Postcondition self-check (before Phase 2; backstop)')
        expect(full).toContain('MISSING_FINISHING_MOVE')
        expect(full).toContain('no double penalty')
        expect(full).toContain('### Phase 2 - rubric judgment (internal mini-schema)')
        expect(full).toContain('### Phase 3 - winner merge and residual issues (internal mini-schema)')
        expect(full).toContain('### Phase 4 - final handoff emission')
        expect(full).not.toContain('### Phase 1 - candidate audit (internal mini-schema)')
        expect(full).not.toContain('There is no candidate-to-candidate')
        expect(full).not.toContain('competition in this run.')
    })

    it('still serializes environmentAffordances in dynamic JSON and documents materialized handoff rows', () => {
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
                    gimmick: 'delivery damage',
                    executionSummary: 'One-line summary.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Beat detail.',
                            members: [{ identifier: 'anvil', tropeFunction: 'terminal payload' }],
                        },
                    },
                    outliers: [],
                }],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        expect(full).toContain('"candidateId":"candidate-1"')
        expect(full).toContain('"stableKey":"anvil"')
        expect(full).toContain('"environmentAffordances"')
        expect(full).toContain('"object":"long-fall"')
        expect(full).not.toContain('drop-ready')
        expect(full).toContain('Handoff JSON (materialized affordances)')
        expect(full).toContain('**incomplete**, not merely unenhanced')
        expect(full).toContain('FM guarantee vs discretionary materialization')
        expect(full).toContain(MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX)
    })
})
