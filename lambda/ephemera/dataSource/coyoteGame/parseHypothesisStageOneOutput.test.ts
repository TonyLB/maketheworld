import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { harnessRoomObjects } from './coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'
import { parseHypothesisStageOneOutput, stripHypothesisStageOneFence } from './parseHypothesisStageOneOutput'

const affinitiesTerminal: CoyoteAffinityPossibility[] = [{ role: 'terminal', aptness: 0.55 }]

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

const validSeamSingleObject = `## Clusters

### Cliff trap
- **stableKey:** anvil-0

\`\`\`json
{"role":"terminal","aptness":0.55}
\`\`\`
`

describe('stripHypothesisStageOneFence', () => {
    it('removes fenced markdown wrapper', () => {
        expect(stripHypothesisStageOneFence('```markdown\n## Clusters\n')).toContain('## Clusters')
        expect(stripHypothesisStageOneFence('```markdown\n## Clusters\n')).not.toContain('```')
    })
})

describe('parseHypothesisStageOneOutput', () => {
    it('accepts valid seam matching snapshot multiset', () => {
        const r = parseHypothesisStageOneOutput(validSeamSingleObject, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.markdown).toContain('## Clusters')
            expect(r.clusters).toHaveLength(1)
            expect(r.clusters[0].members[0].stableKey).toBe('anvil-0')
        }
    })

    it('accepts member without intendedRole when affinities omitted on object', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#VORTEX': [{ uuid: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil-0' }],
        }
        const seam = `## Clusters

### One
- **stableKey:** anvil-0
`
        expect(parseHypothesisStageOneOutput(seam, map).ok).toBe(true)
    })

    it('rejects IntendedRole when affinities unavailable', () => {
        const map: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#VORTEX': [{ uuid: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil-0' }],
        }
        expect(parseHypothesisStageOneOutput(validSeamSingleObject, map).ok).toBe(false)
    })

    it('rejects multiset mismatch', () => {
        const twoObjMap: CoyoteRoomObjectsByRoom = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['rope']),
        }
        expect(parseHypothesisStageOneOutput(validSeamSingleObject, twoObjMap).ok).toBe(false)
    })

    it('rejects invalid intendedRole JSON shape', () => {
        const badSeam = `## Clusters

### One
- **stableKey:** anvil-0

\`\`\`json
{"role":"not_a_role","aptness":0.55}
\`\`\`
`
        expect(parseHypothesisStageOneOutput(badSeam, singleObjectRoomMap).ok).toBe(false)
    })
})
