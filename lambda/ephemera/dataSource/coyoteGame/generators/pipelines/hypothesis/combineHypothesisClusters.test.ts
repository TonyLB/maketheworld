import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import {
    combineHypothesisClusters,
    renderCombinedHypothesisForStageTwo,
    serializePlanSelectCombinedInput,
} from './combineHypothesisClusters'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
import type { ParsedTropeCandidate } from './parseHypothesisStageOneOutput'

describe('combineHypothesisClusters', () => {
    it('hydrates tropeFunction from stage-one members', () => {
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#a' as `OBJECT#${string}`,
                    shortName: 'rope',
                    stableKey: 'rope-0',
                },
            ],
        }
        const candidates: ParsedTropeCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Use rope prep in the opening beat.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Rope links setup pieces before execution.',
                        members: [{ stableKey: 'rope-0', tropeFunction: 'connective rigging between setup pieces' }],
                    },
                ],
            },
        ]
        const r = combineHypothesisClusters(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].tropeAssignments[0].members[0].tropeFunction).toBe(
                'connective rigging between setup pieces'
            )
            expect(r.combined.candidates[0].outliers).toHaveLength(0)
            const md = renderCombinedHypothesisForStageTwo(r.combined, roomMap)
            expect(md).toContain('Candidate candidate-1')
            expect(md).toContain('**tropeFunction:** connective rigging between setup pieces')
        }
    })

    it('derives outliers as multiset complement when tropeAssignments omit staged keys', () => {
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil', 'glue']),
        }
        const candidates: ParsedTropeCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Focus on one object only.',
                tropeAssignments: [
                    {
                        trope: 'Finishing Move',
                        executionDetail: 'Anvil beats only.',
                        members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal-only focus in this candidate' }],
                    },
                ],
            },
        ]
        const r = combineHypothesisClusters(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].outliers).toHaveLength(1)
            expect(r.combined.candidates[0].outliers[0].identifier).toBe('glue-1')
            const md = renderCombinedHypothesisForStageTwo(r.combined, roomMap)
            expect(md).toContain('#### Outliers')
            expect(md).toContain('glue-1')
            expect(md).not.toMatch(/\*\*tropeFunction:\*\*[^\n]*glue/)
        }
    })

    it('derives outliers without using stage-one explicit outlier list', () => {
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#a' as `OBJECT#${string}`,
                    shortName: 'rope',
                    stableKey: 'rope-0',
                },
                {
                    uuid: 'OBJECT#b' as `OBJECT#${string}`,
                    shortName: 'glue',
                    stableKey: 'glue-1',
                },
            ],
        }
        const candidates: ParsedTropeCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Primary glue beat; rope unassigned in tropes.',
                tropeAssignments: [
                    {
                        trope: 'Disadvantage',
                        executionDetail: 'Glue is applied as the persistent constraint.',
                        members: [{ stableKey: 'glue-1', tropeFunction: 'persistent movement constraint on lane' }],
                    },
                ],
            },
        ]
        const r = combineHypothesisClusters(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].outliers).toHaveLength(1)
            expect(r.combined.candidates[0].outliers[0].identifier).toBe('rope-0')
            const md = renderCombinedHypothesisForStageTwo(r.combined, roomMap)
            expect(md).toContain('**room:** CLIFFBASE')
            expect(md).toContain('rope-0')
            const afterOutliers = md.split('#### Outliers')[1] ?? ''
            expect(afterOutliers).toContain('rope-0')
            expect(afterOutliers).not.toMatch(/\*\*tropeFunction:\*\*/)
        }
    })

    it('serializePlanSelectCombinedInput is stable JSON with schemaVersion 2 and outliers without tropeFunction', () => {
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#a' as `OBJECT#${string}`,
                    shortName: 'rope',
                    stableKey: 'rope-0',
                },
                {
                    uuid: 'OBJECT#b' as `OBJECT#${string}`,
                    shortName: 'glue',
                    stableKey: 'glue-1',
                },
            ],
        }
        const candidates: ParsedTropeCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Primary glue beat; rope unassigned in tropes.',
                tropeAssignments: [
                    {
                        trope: 'Disadvantage',
                        executionDetail: 'Glue is applied as the persistent constraint.',
                        members: [{ stableKey: 'glue-1', tropeFunction: 'persistent movement constraint on lane' }],
                    },
                ],
            },
        ]
        const r = combineHypothesisClusters(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (!r.ok) {
            return
        }
        const a = serializePlanSelectCombinedInput(r.combined, roomMap)
        const b = serializePlanSelectCombinedInput(r.combined, roomMap)
        expect(a).toBe(b)
        const parsed = JSON.parse(a) as { schemaVersion: number; candidates: unknown[] }
        expect(parsed.schemaVersion).toBe(2)
        expect(parsed.candidates).toHaveLength(1)
        const c0 = parsed.candidates[0] as {
            candidateId: string
            tropeAssignments: Array<{ members: Array<{ stableKey: string; shortName: string; room: string; tropeFunction: string }> }>
            outliers: Array<{ stableKey: string; shortName: string; room: string; tropeFunction?: string }>
        }
        expect(c0.candidateId).toBe('candidate-1')
        expect(c0.tropeAssignments[0].members[0]).toMatchObject({
            stableKey: 'glue-1',
            shortName: 'glue',
            room: 'CLIFFBASE',
            tropeFunction: 'persistent movement constraint on lane',
        })
        expect(c0.outliers[0]).toMatchObject({ stableKey: 'rope-0', shortName: 'rope', room: 'CLIFFBASE' })
        expect(c0.outliers[0].tropeFunction).toBeUndefined()
    })
})
