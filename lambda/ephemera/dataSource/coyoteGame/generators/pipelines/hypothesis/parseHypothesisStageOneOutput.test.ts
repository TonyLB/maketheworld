import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
import { parseHypothesisStageOneOutput, stripHypothesisStageOneFence } from './parseHypothesisStageOneOutput'

const affinitiesTerminal: CoyoteAffinityPossibility[] = [{ role: 'terminal', aptness: 0.55 }]
const affinitiesRoadRunner: CoyoteAffinityPossibility[] = [{ role: 'influence-road-runner', aptness: 0.67 }]

const singleObjectRoomMap: CoyoteRoomObjectsByRoom = {
    'ROOM#VORTEX': [
        {
            uuid: 'OBJECT#x' as `OBJECT#${string}`,
            shortName: 'anvil',
            stableKey: 'anvil-0',
            affinities: affinitiesTerminal,
        },
    ],
    'ROOM#STRAIGHTAWAY': [],
    'ROOM#CLIFFTOP': [],
    'ROOM#CORNER': [],
    'ROOM#BRIDGE': [],
}

const validJsonSingleObject = JSON.stringify({
    candidates: [
        {
            candidateId: 'candidate-1',
            executionSummary: 'Drop the anvil as the final beat.',
            tropeAssignments: [
                {
                    trope: 'Finishing Move',
                    executionDetail: 'Anvil drops once Road Runner commits to the lane.',
                    members: [{ stableKey: 'anvil-0', intendedRole: { role: 'terminal', aptness: 0.55 } }],
                },
            ],
        },
    ],
})

describe('stripHypothesisStageOneFence', () => {
    it('removes fenced wrapper', () => {
        expect(stripHypothesisStageOneFence('```json\n{"clusters":[]}\n```')).toBe('{"clusters":[]}')
        expect(stripHypothesisStageOneFence('```markdown\n{"x":1}\n```')).toContain('"x":1')
        expect(stripHypothesisStageOneFence('```markdown\n{"x":1}\n```')).not.toContain('```')
    })
})

describe('parseHypothesisStageOneOutput', () => {
    it('accepts valid trope-candidate JSON matching snapshot multiset', () => {
        const r = parseHypothesisStageOneOutput(validJsonSingleObject, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.normalizedJson).toContain('"stableKey":"anvil-0"')
            expect(r.candidates).toHaveLength(1)
            expect(r.candidates[0].tropeAssignments[0].members[0].stableKey).toBe('anvil-0')
            expect(r.candidates[0].tropeAssignments[0].members[0].intendedRole).toEqual({
                role: 'terminal',
                aptness: 0.55,
            })
        }
    })

    it('accepts intendedRole echo without aptness and resolves from snapshot', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', intendedRole: { role: 'terminal' } }],
                        },
                    ],
                },
            ],
        })
        const r = parseHypothesisStageOneOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments[0].members[0].intendedRole).toEqual({
                role: 'terminal',
                aptness: 0.55,
            })
        }
    })

    it('accepts trope member without intendedRole when affinities omitted on object', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#VORTEX': [{ uuid: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil-0' }],
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0' }],
                        },
                    ],
                },
            ],
        })
        expect(parseHypothesisStageOneOutput(body, map).ok).toBe(true)
    })

    it('rejects IntendedRole when affinities unavailable', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#VORTEX': [{ uuid: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil-0' }],
        }
        expect(parseHypothesisStageOneOutput(validJsonSingleObject, map).ok).toBe(false)
    })

    it('rejects candidate multiset mismatch', () => {
        const twoObjMap: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        expect(parseHypothesisStageOneOutput(validJsonSingleObject, twoObjMap).ok).toBe(false)
    })

    it('rejects invalid intendedRole JSON shape', () => {
        const bad = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', intendedRole: { role: 'not_a_role', aptness: 0.55 } }],
                        },
                    ],
                },
            ],
        })
        expect(parseHypothesisStageOneOutput(bad, singleObjectRoomMap).ok).toBe(false)
    })

    it('resolves flat-tag intendedRole echo from snapshot affinities', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#VORTEX': [
                {
                    uuid: 'OBJECT#x' as `OBJECT#${string}`,
                    shortName: 'birdseed',
                    stableKey: 'anvil-0',
                    affinities: affinitiesRoadRunner,
                },
            ],
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Use bait first.',
                    tropeAssignments: [
                        {
                            trope: 'Distraction',
                            executionDetail: 'Road Runner is lured into lane.',
                            members: [{ stableKey: 'anvil-0', intendedRole: { role: 'influence-road-runner' } }],
                        },
                    ],
                },
            ],
        })
        const r = parseHypothesisStageOneOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments[0].members[0].intendedRole).toEqual({
                role: 'influence-road-runner',
                aptness: 0.67,
            })
        }
    })

    it('extracts JSON object when preceded by prose', () => {
        const body = `Here you go:\n${validJsonSingleObject}\nThanks`
        expect(parseHypothesisStageOneOutput(body, singleObjectRoomMap).ok).toBe(true)
    })

    it('canonical normalizedJson lists candidates before notes', () => {
        const body = JSON.stringify({
            notes: 'Written first by model still parses.',
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0' }],
                        },
                    ],
                },
            ],
        })
        const r = parseHypothesisStageOneOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.normalizedJson.indexOf('"candidates"')).toBeLessThan(r.normalizedJson.indexOf('"notes"'))
        }
    })

    it('accepts tropeAssignments ∪ outliers partition per candidate', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Primary trap on the anvil lane.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Anvil lane execution.',
                            members: [{ stableKey: 'anvil-0' }],
                        },
                    ],
                    outliers: [{ stableKey: 'rope-0' }],
                },
            ],
        })
        const r = parseHypothesisStageOneOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].explicitOutliers).toEqual([{ stableKey: 'rope-0' }])
        }
    })

    it('rejects stableKey in both tropeAssignments and outliers', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Primary trap on the anvil lane.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Anvil lane execution.',
                            members: [{ stableKey: 'anvil-0' }, { stableKey: 'rope-0' }],
                        },
                    ],
                    outliers: [{ stableKey: 'rope-0' }],
                },
            ],
        })
        expect(parseHypothesisStageOneOutput(body, map).ok).toBe(false)
    })

    it('rejects unknown root keys', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0' }],
                        },
                    ],
                },
            ],
            debug: 'extra',
        })
        const r = parseHypothesisStageOneOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.errorMessage).toContain('unknown root key')
        }
    })

    it('rejects unknown candidate and trope/member keys', () => {
        const badCandidate = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0' }],
                        },
                    ],
                    score: 'extra',
                },
            ],
        })
        const clusterResult = parseHypothesisStageOneOutput(badCandidate, singleObjectRoomMap)
        expect(clusterResult.ok).toBe(false)
        if (!clusterResult.ok) {
            expect(clusterResult.errorMessage).toContain('unknown key')
        }

        const badMember = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', name: 'extra' }],
                        },
                    ],
                },
            ],
        })
        const memberResult = parseHypothesisStageOneOutput(badMember, singleObjectRoomMap)
        expect(memberResult.ok).toBe(false)
        if (!memberResult.ok) {
            expect(memberResult.errorMessage).toContain('unknown key')
        }
    })

    it('rejects partial candidate output with missing execution fields', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    tropeAssignments: [{ trope: 'Finishing Move', members: [{ stableKey: 'anvil-0' }] }],
                },
            ],
        })
        expect(parseHypothesisStageOneOutput(body, singleObjectRoomMap).ok).toBe(false)
    })

    it('rejects trope assignments out of canonical order', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Order check.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'End first.',
                            members: [{ stableKey: 'anvil-0' }],
                        },
                        {
                            trope: 'Contraption',
                            executionDetail: 'Setup second.',
                            members: [{ stableKey: 'rope-0' }],
                        },
                    ],
                },
            ],
        })
        expect(parseHypothesisStageOneOutput(body, map).ok).toBe(false)
    })
})
