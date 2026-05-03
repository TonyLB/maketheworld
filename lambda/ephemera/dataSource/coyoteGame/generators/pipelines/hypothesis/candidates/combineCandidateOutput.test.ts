import { harnessRoomObjects } from '../../../testHarness/coyoteEngineTestFixtures'
import {
    combineCandidateOutput,
    renderCombinedCandidateOutputForNarrativeBeat,
    serializePlanSelectCandidateInput,
} from './combineCandidateOutput'
import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'
import type { ParsedCandidate } from './parseCandidateOutput'

describe('combineCandidateOutput', () => {
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
        const candidates: ParsedCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Use rope prep in the opening beat.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Rope links setup pieces before execution.',
                        members: [{ stableKey: 'rope-0', tropeFunction: 'connective rigging between setup pieces' }],
                    },
                },
            },
        ]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].tropeAssignments.Contraption?.members[0].tropeFunction).toBe(
                'connective rigging between setup pieces'
            )
            expect(r.combined.candidates[0].outliers).toHaveLength(0)
            // Pool Markdown helper; narrative beat uses ## Committed plan, not this renderer.
            const md = renderCombinedCandidateOutputForNarrativeBeat(r.combined, roomMap)
            expect(md).toContain('Candidate candidate-1')
            expect(md).toContain('**tropeFunction:** connective rigging between setup pieces')
        }
    })

    it('derives outliers as multiset complement when tropeAssignments omit staged keys', () => {
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil', 'glue']),
        }
        const candidates: ParsedCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Focus on one object only.',
                tropeAssignments: {
                    'Finishing Move': {
                        executionDetail: 'Anvil beats only.',
                        members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal-only focus in this candidate' }],
                    },
                },
            },
        ]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].outliers).toHaveLength(1)
            expect(r.combined.candidates[0].outliers[0].identifier).toBe('glue-1')
            // Pool Markdown helper; narrative beat uses ## Committed plan, not this renderer.
            const md = renderCombinedCandidateOutputForNarrativeBeat(r.combined, roomMap)
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
        const candidates: ParsedCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Primary glue beat; rope unassigned in tropes.',
                tropeAssignments: {
                    Disadvantage: {
                        executionDetail: 'Glue is applied as the persistent constraint.',
                        members: [{ stableKey: 'glue-1', tropeFunction: 'persistent movement constraint on lane' }],
                    },
                },
            },
        ]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].outliers).toHaveLength(1)
            expect(r.combined.candidates[0].outliers[0].identifier).toBe('rope-0')
            // Pool Markdown helper; narrative beat uses ## Committed plan, not this renderer.
            const md = renderCombinedCandidateOutputForNarrativeBeat(r.combined, roomMap)
            expect(md).toContain('**room:** CLIFFBASE')
            expect(md).toContain('rope-0')
            const afterOutliers = md.split('#### Outliers')[1] ?? ''
            expect(afterOutliers).toContain('rope-0')
            expect(afterOutliers).not.toMatch(/\*\*tropeFunction:\*\*/)
        }
    })

    it('serializePlanSelectCandidateInput is stable JSON with schemaVersion 3 and outliers without tropeFunction', () => {
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
        const candidates: ParsedCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Primary glue beat; rope unassigned in tropes.',
                tropeAssignments: {
                    Disadvantage: {
                        executionDetail: 'Glue is applied as the persistent constraint.',
                        members: [{ stableKey: 'glue-1', tropeFunction: 'persistent movement constraint on lane' }],
                    },
                },
            },
        ]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (!r.ok) {
            return
        }
        const a = serializePlanSelectCandidateInput(r.combined, roomMap)
        const b = serializePlanSelectCandidateInput(r.combined, roomMap)
        expect(a).toBe(b)
        const parsed = JSON.parse(a) as { schemaVersion: number; candidates: unknown[] }
        expect(parsed.schemaVersion).toBe(3)
        expect(parsed.candidates).toHaveLength(1)
        const c0 = parsed.candidates[0] as {
            candidateId: string
            tropeAssignments: Partial<Record<
                'Contraption' | 'Bait' | 'Misdirection' | 'Disadvantage' | 'Finishing Move',
                { executionDetail: string; members: Array<{ stableKey: string; shortName: string; room: string; tropeFunction: string }> }
            >>
            outliers: Array<{ stableKey: string; shortName: string; room: string; tropeFunction?: string }>
        }
        expect(c0.candidateId).toBe('candidate-1')
        expect(Array.isArray(c0.tropeAssignments)).toBe(false)
        expect(c0.tropeAssignments.Disadvantage?.members[0]).toMatchObject({
            stableKey: 'glue-1',
            shortName: 'glue',
            room: 'CLIFFBASE',
            tropeFunction: 'persistent movement constraint on lane',
        })
        expect(c0.outliers[0]).toMatchObject({ stableKey: 'rope-0', shortName: 'rope', room: 'CLIFFBASE' })
        expect(c0.outliers[0].tropeFunction).toBeUndefined()
    })

    it('serializePlanSelectCandidateInput includes affordancesProvided from staged tropeAffinities on members', () => {
        const affordancesProvided = [
            { object: 'hidden catapult', intended: true as const, roles: ['Contraption' as const] },
        ]
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [{
                uuid: 'OBJECT#g' as `OBJECT#${string}`,
                shortName: 'glue',
                stableKey: 'glue-1',
                tropeAffinities: [{
                    trope: 'Disadvantage',
                    aptness: 'High',
                    narrowing: 'rig',
                    affordancesProvided,
                }],
            }],
        }
        const candidates: ParsedCandidate[] = [{
            candidateId: 'candidate-1',
            executionSummary: 'Glue constraint beat.',
            tropeAssignments: {
                Disadvantage: {
                    executionDetail: 'Glue applies persistent constraint.',
                    members: [{ stableKey: 'glue-1', tropeFunction: 'persistent constraint' }],
                },
            },
        }]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (!r.ok) {
            return
        }
        const json = serializePlanSelectCandidateInput(r.combined, roomMap)
        const parsed = JSON.parse(json) as {
            candidates: Array<{
                tropeAssignments: Partial<Record<'Disadvantage', {
                    members: Array<{ stableKey: string; affordancesProvided?: typeof affordancesProvided }>
                }>>
            }>
        }
        expect(parsed.candidates[0].tropeAssignments.Disadvantage?.members[0].affordancesProvided).toEqual(
            affordancesProvided
        )
    })

    it('serializePlanSelectCandidateInput includes affordancesProvided on outliers when staged object has them', () => {
        const affordancesProvided = [{ object: 'coil spring', roles: ['Contraption' as const] }]
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#g' as `OBJECT#${string}`,
                    shortName: 'glue',
                    stableKey: 'glue-1',
                    tropeAffinities: [{ trope: 'Disadvantage', aptness: 'High', narrowing: 'stick' }],
                },
                {
                    uuid: 'OBJECT#r' as `OBJECT#${string}`,
                    shortName: 'rope',
                    stableKey: 'rope-0',
                    tropeAffinities: [{
                        trope: 'Contraption',
                        aptness: 'Good',
                        narrowing: 'line',
                        affordancesProvided,
                    }],
                },
            ],
        }
        const candidates: ParsedCandidate[] = [{
            candidateId: 'candidate-1',
            executionSummary: 'Glue only.',
            tropeAssignments: {
                Disadvantage: {
                    executionDetail: 'Glue applies persistent constraint.',
                    members: [{ stableKey: 'glue-1', tropeFunction: 'persistent constraint' }],
                },
            },
        }]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (!r.ok) {
            return
        }
        const json = serializePlanSelectCandidateInput(r.combined, roomMap)
        const parsed = JSON.parse(json) as {
            candidates: Array<{ outliers: Array<{ stableKey: string; affordancesProvided?: typeof affordancesProvided }> }>
        }
        expect(parsed.candidates[0].outliers).toHaveLength(1)
        expect(parsed.candidates[0].outliers[0].stableKey).toBe('rope-0')
        expect(parsed.candidates[0].outliers[0].affordancesProvided).toEqual(affordancesProvided)
    })

    it('serializePlanSelectCandidateInput includes environmentAffordances from staged tropeAffinities on members', () => {
        const environmentAffordances = [{ object: 'long-fall' as const, roles: ['Finishing Move' as const] }]
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [{
                uuid: 'OBJECT#g' as `OBJECT#${string}`,
                shortName: 'rocket skates',
                stableKey: 'rocket-skates',
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'mobility',
                    environmentAffordances,
                }],
            }],
        }
        const candidates: ParsedCandidate[] = [{
            candidateId: 'candidate-1',
            executionSummary: 'Skates beat.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Skates deliver speed.',
                    members: [{ stableKey: 'rocket-skates', tropeFunction: 'mobility' }],
                },
            },
        }]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (!r.ok) {
            return
        }
        const json = serializePlanSelectCandidateInput(r.combined, roomMap)
        const parsed = JSON.parse(json) as {
            candidates: Array<{
                tropeAssignments: Partial<Record<'Contraption', {
                    members: Array<{ stableKey: string; environmentAffordances?: typeof environmentAffordances }>
                }>>
            }>
        }
        expect(parsed.candidates[0].tropeAssignments.Contraption?.members[0].environmentAffordances).toEqual(
            environmentAffordances
        )
    })

    it('serializePlanSelectCandidateInput includes environmentAffordances on outliers when staged object has them', () => {
        const environmentAffordances = [{ object: 'rock-wall' as const, roles: ['Finishing Move' as const] }]
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#g' as `OBJECT#${string}`,
                    shortName: 'glue',
                    stableKey: 'glue-1',
                    tropeAffinities: [{ trope: 'Disadvantage', aptness: 'High', narrowing: 'stick' }],
                },
                {
                    uuid: 'OBJECT#b' as `OBJECT#${string}`,
                    shortName: 'boulder',
                    stableKey: 'boulder-0',
                    tropeAffinities: [{
                        trope: 'Finishing Move',
                        aptness: 'High',
                        narrowing: 'crush',
                        environmentAffordances,
                    }],
                },
            ],
        }
        const candidates: ParsedCandidate[] = [{
            candidateId: 'candidate-1',
            executionSummary: 'Glue only.',
            tropeAssignments: {
                Disadvantage: {
                    executionDetail: 'Glue applies persistent constraint.',
                    members: [{ stableKey: 'glue-1', tropeFunction: 'persistent constraint' }],
                },
            },
        }]
        const r = combineCandidateOutput(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (!r.ok) {
            return
        }
        const json = serializePlanSelectCandidateInput(r.combined, roomMap)
        const parsed = JSON.parse(json) as {
            candidates: Array<{
                outliers: Array<{ stableKey: string; environmentAffordances?: typeof environmentAffordances }>
            }>
        }
        expect(parsed.candidates[0].outliers).toHaveLength(1)
        expect(parsed.candidates[0].outliers[0].stableKey).toBe('boulder-0')
        expect(parsed.candidates[0].outliers[0].environmentAffordances).toEqual(environmentAffordances)
    })
})
