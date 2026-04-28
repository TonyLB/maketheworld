import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import { combineHypothesisClusters, renderCombinedHypothesisForStageTwo } from './combineHypothesisClusters'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
import type { ParsedTropeCandidate } from './parseHypothesisStageOneOutput'

describe('combineHypothesisClusters', () => {
    it('hydrates canonical intendedRole from snapshot', () => {
        const prep: CoyoteAffinityPossibility = { role: 'connect-props', aptness: 0.71 }
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#a' as `OBJECT#${string}`,
                    shortName: 'rope',
                    stableKey: 'rope-0',
                    affinities: [prep],
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
                        members: [{ stableKey: 'rope-0', intendedRole: { role: 'connect-props', aptness: 0.71 } }],
                    },
                ],
            },
        ]
        const r = combineHypothesisClusters(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].tropeAssignments[0].members[0].intendedRole).toEqual(prep)
            expect(r.combined.candidates[0].outliers).toHaveLength(0)
            const md = renderCombinedHypothesisForStageTwo(r.combined, roomMap)
            expect(md).toContain('Candidate candidate-1')
            expect(md).toContain('**intendedRole:** connect-props 0.71')
        }
    })

    it('lists outliers when cluster membership does not cover snapshot', () => {
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
                        members: [{ stableKey: 'anvil-0' }],
                    },
                ],
            },
        ]
        const r = combineHypothesisClusters(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].outliers).toHaveLength(0)
        }
    })

    it('uses explicit outliers from Stage One when provided', () => {
        const prep: CoyoteAffinityPossibility = { role: 'prep', aptness: 0.71 }
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#a' as `OBJECT#${string}`,
                    shortName: 'rope',
                    stableKey: 'rope-0',
                    affinities: [prep],
                },
                {
                    uuid: 'OBJECT#b' as `OBJECT#${string}`,
                    shortName: 'glue',
                    stableKey: 'glue-1',
                    affinities: [{ role: 'creation', aptness: 0.5 }],
                },
            ],
        }
        const candidates: ParsedTropeCandidate[] = [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Primary glue beat with rope as explicit outlier.',
                tropeAssignments: [
                    {
                        trope: 'Disadvantage',
                        executionDetail: 'Glue is applied as the persistent constraint.',
                        members: [{ stableKey: 'glue-1' }],
                    },
                ],
                explicitOutliers: [{ stableKey: 'rope-0', intendedRole: prep }],
            },
        ]
        const r = combineHypothesisClusters(candidates, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.candidates[0].outliers).toHaveLength(1)
            expect(r.combined.candidates[0].outliers[0].identifier).toBe('rope-0')
            expect(r.combined.candidates[0].outliers[0].intendedRole).toEqual(prep)
            const md = renderCombinedHypothesisForStageTwo(r.combined, roomMap)
            expect(md).toContain('**room:** VORTEX')
            expect(md).toContain('**intendedRole:** prep 0.71')
        }
    })
})
