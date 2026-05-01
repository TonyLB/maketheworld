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
            tropeAssignments: [
                {
                    trope: 'Finishing Move',
                    executionDetail: 'Anvil drops once Road Runner commits to the lane.',
                    members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                },
            ],
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
            expect(r.candidates[0].tropeAssignments[0].members[0].stableKey).toBe('anvil-0')
            expect(r.candidates[0].tropeAssignments[0].members[0].tropeFunction).toBe('terminal drop payload')
        }
    })

    it('accepts tropeFunction member annotations', () => {
        const body = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    ],
                },
            ],
        })
        const r = parseCandidateOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments[0].members[0].tropeFunction).toBe('terminal drop payload')
        }
    })

    it('rejects trope member missing tropeFunction', () => {
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

    it('rejects legacy intendedRole key under strict member schema', () => {
        const bad = JSON.stringify({
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Drop the anvil.',
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal', intendedRole: { role: 'terminal' } }],
                        },
                    ],
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
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    ],
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
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Anvil lane execution.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal lane payload' }],
                        },
                    ],
                    outliers: [{ stableKey: 'rope-0' }],
                },
            ],
        })
        const r = parseCandidateOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.candidates[0].tropeAssignments[0].members).toHaveLength(1)
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
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Anvil lane execution.',
                            members: [
                                { stableKey: 'anvil-0', tropeFunction: 'terminal lane payload' },
                                { stableKey: 'rope-0', tropeFunction: 'also in trope row' },
                            ],
                        },
                    ],
                    outliers: [{ stableKey: 'rope-0' }],
                },
            ],
        })
        expect(parseCandidateOutput(body, map).ok).toBe(true)
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
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Anvil lane execution.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal lane payload' }],
                        },
                    ],
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
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    ],
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
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload' }],
                        },
                    ],
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
                    tropeAssignments: [
                        {
                            trope: 'Finishing Move',
                            executionDetail: 'Trigger the terminal drop.',
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal drop payload', name: 'extra' }],
                        },
                    ],
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
                    tropeAssignments: [{ trope: 'Finishing Move', members: [{ stableKey: 'anvil-0' }] }],
                },
            ],
        })
        expect(parseCandidateOutput(body, singleObjectRoomMap).ok).toBe(false)
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
                            members: [{ stableKey: 'anvil-0', tropeFunction: 'terminal beat first' }],
                        },
                        {
                            trope: 'Contraption',
                            executionDetail: 'Setup second.',
                            members: [{ stableKey: 'rope-0', tropeFunction: 'setup beat second' }],
                        },
                    ],
                },
            ],
        })
        expect(parseCandidateOutput(body, map).ok).toBe(false)
    })
})
