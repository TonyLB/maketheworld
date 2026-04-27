import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from '../../../coyoteRoomObjectSnapshot'
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
    clusters: [
        {
            clusterName: 'Cliff trap',
            members: [{ stableKey: 'anvil-0', intendedRole: { role: 'terminal', aptness: 0.55 } }],
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
    it('accepts valid JSON matching snapshot multiset', () => {
        const r = parseHypothesisStageOneOutput(validJsonSingleObject, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.normalizedJson).toContain('"stableKey":"anvil-0"')
            expect(r.clusters).toHaveLength(1)
            expect(r.clusters[0].members[0].stableKey).toBe('anvil-0')
            expect(r.clusters[0].members[0].intendedRole).toEqual({ role: 'terminal', aptness: 0.55 })
        }
    })

    it('accepts intendedRole echo without aptness and resolves from snapshot', () => {
        const body = JSON.stringify({
            clusters: [
                {
                    clusterName: 'One',
                    members: [{ stableKey: 'anvil-0', intendedRole: { role: 'terminal' } }],
                },
            ],
        })
        const r = parseHypothesisStageOneOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.clusters[0].members[0].intendedRole).toEqual({ role: 'terminal', aptness: 0.55 })
        }
    })

    it('accepts member without intendedRole when affinities omitted on object', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#VORTEX': [{ uuid: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil-0' }],
        }
        const body = JSON.stringify({
            clusters: [{ clusterName: 'One', members: [{ stableKey: 'anvil-0' }] }],
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

    it('rejects multiset mismatch', () => {
        const twoObjMap: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        expect(parseHypothesisStageOneOutput(validJsonSingleObject, twoObjMap).ok).toBe(false)
    })

    it('rejects invalid intendedRole JSON shape', () => {
        const bad = JSON.stringify({
            clusters: [
                {
                    clusterName: 'One',
                    members: [{ stableKey: 'anvil-0', intendedRole: { role: 'not_a_role', aptness: 0.55 } }],
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
            clusters: [
                {
                    clusterName: 'Bait',
                    members: [{ stableKey: 'anvil-0', intendedRole: { role: 'influence-road-runner' } }],
                },
            ],
        })
        const r = parseHypothesisStageOneOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.clusters[0].members[0].intendedRole).toEqual({
                role: 'influence-road-runner',
                aptness: 0.67,
            })
        }
    })

    it('extracts JSON object when preceded by prose', () => {
        const body = `Here you go:\n${validJsonSingleObject}\nThanks`
        expect(parseHypothesisStageOneOutput(body, singleObjectRoomMap).ok).toBe(true)
    })

    it('canonical normalizedJson lists clusters before notes', () => {
        const body = JSON.stringify({
            notes: 'Written first by model still parses.',
            clusters: [{ clusterName: 'Solo', members: [{ stableKey: 'anvil-0' }] }],
        })
        const r = parseHypothesisStageOneOutput(body, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.normalizedJson.indexOf('"clusters"')).toBeLessThan(r.normalizedJson.indexOf('"notes"'))
        }
    })

    it('accepts clusters ∪ outliers partition when outliers key is present', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            clusters: [{ clusterName: 'Main', members: [{ stableKey: 'anvil-0' }] }],
            outliers: [{ stableKey: 'rope-0' }],
        })
        const r = parseHypothesisStageOneOutput(body, map)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.explicitOutliers).toEqual([{ stableKey: 'rope-0' }])
            expect(r.normalizedJson).toContain('"outliers"')
        }
    })

    it('rejects stableKey in both clusters and outliers', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        const body = JSON.stringify({
            clusters: [{ clusterName: 'Main', members: [{ stableKey: 'anvil-0' }, { stableKey: 'rope-0' }] }],
            outliers: [{ stableKey: 'rope-0' }],
        })
        expect(parseHypothesisStageOneOutput(body, map).ok).toBe(false)
    })
})
