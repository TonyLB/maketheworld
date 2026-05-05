import { harnessRoomObjects } from '../../../testHarness/coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'
import { parseCandidateOutput, stripCandidateOutputFence } from './parseCandidateOutput'

const singleObjectRoomMap: CoyoteRoomObjectsByRoom = {
    'ROOM#VORTEX': [
        {
            uuid: 'OBJECT#x' as `OBJECT#${string}`,
            shortName: 'anvil',
            stableKey: 'anvil-0',
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
            tropeAssignments: {
                'Finishing Move': {
                    executionDetail: 'Anvil drops once Road Runner commits to the lane.',
                    members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                },
            },
        },
    ],
})

describe('stripCandidateOutputFence', () => {
    it('removes fenced wrapper', () => {
        expect(stripCandidateOutputFence('```json\n{"clusters":[]}\n```')).toBe('{"clusters":[]}')
        expect(stripCandidateOutputFence('```markdown\n{"x":1}\n```')).toContain('"x":1')
        expect(stripCandidateOutputFence('```markdown\n{"x":1}\n```')).not.toContain('```')
    })
})

describe('parseCandidateOutput', () => {
    it('accepts valid trope-candidate JSON matching snapshot multiset', () => {
        const r = parseCandidateOutput(validJsonSingleObject, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.normalizedJson).toContain('"stableKey":"anvil-0"')
            expect(r.candidates).toHaveLength(1)
            expect(r.candidates[0].tropeAssignments['Finishing Move']?.members[0].stableKey).toBe('anvil-0')
            expect(r.candidates[0].tropeAssignments['Finishing Move']?.members[0].tropeFunction).toBe('terminal drop payload')
        }
    })

    it('accepts tropeFunction member annotations', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    },
                },
            ],
        })
        const r = parseCandidateOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments['Finishing Move']?.members[0].tropeFunction).toBe('terminal drop payload')
        }
    })

    it('accepts optional environmentAffordances and affordancesProvided on members and outliers', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Use affordance evidence on rows.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Rope read as launcher geometry.',
                            members: [
                                {
                                    stableKey: 'rope-0',
                                    tropeFunction: 'launcher rig',
                                    environmentAffordances: [{ object: 'rock-wall', roles: ['Contraption'] }],
                                    affordancesProvided: [{ object: 'cannonball', roles: ['Finishing Move'] }],
                                },
                            ],
                        },
                        'Finishing Move': {
                            executionDetail: 'Anvil drops as terminal beat.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    },
                    outliers: [
                        {
                            stableKey: 'rope-0',
                            environmentAffordances: [{ object: 'rock-wall', roles: ['Contraption'] }],
                            affordancesProvided: [{ object: 'cannonball', roles: ['Finishing Move'] }],
                        },
                    ],
                },
            ],
        })
        const r = parseCandidateOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            const member = r.candidates[0].tropeAssignments.Contraption?.members[0]
            expect(member?.environmentAffordances).toEqual([{ object: 'rock-wall', roles: ['Contraption'] }])
            expect(member?.affordancesProvided).toEqual([{ object: 'cannonball', roles: ['Finishing Move'] }])
        }
    })

    it('rejects malformed environmentAffordances or affordancesProvided on member rows', () => {
        const badEnvironment = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Bad row shape.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [
                                {
                                    stableKey: 'anvil-0',
                                    tropeFunction: 'terminal drop payload',
                                    environmentAffordances: [{ object: 'not-real', roles: ['Finishing Move'] }],
                                },
                            ],
                        },
                    },
                },
            ],
        })
        const badEnvironmentResult = parseCandidateOutput(badEnvironment, singleObjectRoomMap)
        expect(badEnvironmentResult.ok).toBe(false)
        if (!badEnvironmentResult.ok) {
            expect(badEnvironmentResult.errorMessage).toContain('malformed environmentAffordances')
        }

        const badProvided = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Bad row shape.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [
                                {
                                    stableKey: 'anvil-0',
                                    tropeFunction: 'terminal drop payload',
                                    affordancesProvided: [{ object: '', roles: ['Finishing Move'] }],
                                },
                            ],
                        },
                    },
                },
            ],
        })
        const badProvidedResult = parseCandidateOutput(badProvided, singleObjectRoomMap)
        expect(badProvidedResult.ok).toBe(false)
        if (!badProvidedResult.ok) {
            expect(badProvidedResult.errorMessage).toContain('malformed affordancesProvided')
        }
    })

    it('rejects malformed environmentAffordances or affordancesProvided on outlier rows', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const badOutlier = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Outlier affordance shape regression.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Anvil lane execution.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal lane payload' }],
                        },
                    },
                    outliers: [
                        {
                            stableKey: 'rope-0',
                            affordancesProvided: [{ object: 'cannonball', intended: false, roles: ['Finishing Move'] }],
                        },
                    ],
                },
            ],
        })
        const r = parseCandidateOutput(badOutlier, map)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.errorMessage).toContain('malformed affordancesProvided')
        }
    })

    it('rejects trope member missing tropeFunction', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0' }],
                        },
                    },
                },
            ],
        })
        expect(parseCandidateOutput(body, singleObjectRoomMap).ok).toBe(false)
    })

    it('accepts tropeAssignments subset when staged multiset is larger', () => {
        const twoObjMap: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const r = parseCandidateOutput(validJsonSingleObject, twoObjMap)
        expect(r.ok).toBe(true)
    })

    it('trims duplicate stableKey usage across trope rows to snapshot capacity', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'One object appears in two trope rows.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Use anvil as setup weight.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'counterweight rig' }],
                        },
                        'Finishing Move': {
                            executionDetail: 'Use anvil as terminal payload.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    },
                },
            ],
        })
        const r = parseCandidateOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments.Contraption?.members).toHaveLength(1)
            expect(r.candidates[0].tropeAssignments['Finishing Move']).toBeUndefined()
        }
    })

    it('rejects legacy intendedRole key under strict member schema', () => {
        const bad = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal', intendedRole: { role: 'terminal' } }],
                        },
                    },
                },
            ],
        })
        const r = parseCandidateOutput(bad, singleObjectRoomMap)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.errorMessage).toContain('unknown key')
        }
    })

    it('extracts JSON object when preceded by prose', () => {
        const body = `Here you go:\n${validJsonSingleObject}\nThanks`
        expect(parseCandidateOutput(body, singleObjectRoomMap).ok).toBe(true)
    })

    it('canonical normalizedJson lists candidates before notes', () => {
        const body = JSON.stringify({
            notes: 'Written first by model still parses.',
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    },
                },
            ],
        })
        const r = parseCandidateOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.normalizedJson.indexOf('"candidates"')).toBeLessThan(r.normalizedJson.indexOf('"notes"'))
        }
    })

    it('accepts stableKey-only outliers scaffolding with partial trope coverage', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Primary trap on the anvil lane.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Anvil lane execution.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal lane payload' }],
                        },
                    },
                    outliers: [{ stableKey: 'rope-0' }],
                },
            ],
        })
        const r = parseCandidateOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments['Finishing Move']?.members).toHaveLength(1)
        }
    })

    it('accepts overlapping stableKey in tropeAssignments and outliers scaffolding (not authoritative)', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Primary trap on the anvil lane.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Anvil lane execution.',
                            members: [
                                { stableKey: 'anvil-0', tropeFunction: 'terminal lane payload' },
                                { stableKey: 'rope-0', tropeFunction: 'also in trope row' },
                            ],
                        },
                    },
                    outliers: [{ stableKey: 'rope-0' }],
                },
            ],
        })
        expect(parseCandidateOutput(body, map).ok).toBe(true)
    })

    it('drops trope rows whose members array is empty', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Keep only rows with assigned members.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'No staged member assigned yet.',
                            members: [],
                        },
                        'Finishing Move': {
                            executionDetail: 'Terminal row has an actual member.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    },
                },
            ],
        })
        const r = parseCandidateOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments.Contraption).toBeUndefined()
            expect(r.candidates[0].tropeAssignments['Finishing Move']?.members).toHaveLength(1)
        }
    })

    it('rejects tropeFunction key on outlier row (strict stableKey-only)', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Primary trap on the anvil lane.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Anvil lane execution.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal lane payload' }],
                        },
                    },
                    outliers: [{ stableKey: 'rope-0', tropeFunction: 'not allowed on outlier' }],
                },
            ],
        })
        const r = parseCandidateOutput(body, map)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.errorMessage).toContain('unknown key')
        }
    })

    it('rejects unknown root keys', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    },
                },
            ],
            debug: 'extra',
        })
        const r = parseCandidateOutput(body, singleObjectRoomMap)
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
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    },
                    score: 'extra',
                },
            ],
        })
        const clusterResult = parseCandidateOutput(badCandidate, singleObjectRoomMap)
        expect(clusterResult.ok).toBe(false)
        if (!clusterResult.ok) {
            expect(clusterResult.errorMessage).toContain('unknown key')
        }

        const badMember = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload', name: 'extra' }],
                        },
                    },
                },
            ],
        })
        const memberResult = parseCandidateOutput(badMember, singleObjectRoomMap)
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
                    tropeAssignments: { 'Finishing Move': { members: [{ stableKey: 'anvil-0' }] } },
                },
            ],
        })
        expect(parseCandidateOutput(body, singleObjectRoomMap).ok).toBe(false)
    })

    it('normalizes trope assignment record keys to canonical trope order in normalizedJson', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Order check.',
                    tropeAssignments: {
                        'Finishing Move': {
                            executionDetail: 'End first.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal beat first' }],
                        },
                        Contraption: {
                            executionDetail: 'Setup second.',
                            members: [{ stableKey: 'rope-0', tropeFunction: 'setup beat second' }],
                        },
                    },
                },
            ],
        })
        const result = parseCandidateOutput(body, map)
        expect(result.ok).toBe(true)
        if (result.ok) {
            const contraptionIndex = result.normalizedJson.indexOf('"Contraption"')
            const finishingMoveIndex = result.normalizedJson.indexOf('"Finishing Move"')
            expect(contraptionIndex).toBeGreaterThan(-1)
            expect(finishingMoveIndex).toBeGreaterThan(-1)
            expect(contraptionIndex).toBeLessThan(finishingMoveIndex)
        }
    })

    it('rejects array-shaped tropeAssignments (hard cutover)', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Legacy shape should fail.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Legacy row.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'legacy' }],
                        },
                    ],
                },
            ],
        })
        expect(parseCandidateOutput(body, singleObjectRoomMap).ok).toBe(false)
    })

    it('rejects empty tropeAssignments record', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Empty trope record should fail.',
                    tropeAssignments: {},
                },
            ],
        })
        expect(parseCandidateOutput(body, singleObjectRoomMap).ok).toBe(false)
    })
})
