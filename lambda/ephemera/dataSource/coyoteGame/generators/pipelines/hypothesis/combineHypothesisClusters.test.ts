import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import { combineHypothesisClusters, renderCombinedHypothesisForStageTwo } from './combineHypothesisClusters'
import type { CoyoteRoomObjectsByRoom } from '../../../coyoteRoomObjectSnapshot'
import type { ParsedCluster } from './parseHypothesisStageOneOutput'

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
        const clusters: ParsedCluster[] = [
            {
                clusterName: 'Prep',
                members: [{ stableKey: 'rope-0', intendedRole: { role: 'connect-props', aptness: 0.71 } }],
            },
        ]
        const r = combineHypothesisClusters(clusters, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.clusters[0].members[0].intendedRole).toEqual(prep)
            expect(r.combined.outliers).toHaveLength(0)
            const md = renderCombinedHypothesisForStageTwo(r.combined, roomMap)
            expect(md).toContain('**intendedRole:** connect-props 0.71')
        }
    })

    it('lists outliers when cluster membership does not cover snapshot', () => {
        const roomMap: CoyoteRoomObjectsByRoom = {
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil', 'glue']),
        }
        const clusters: ParsedCluster[] = [
            {
                clusterName: 'Only',
                members: [{ stableKey: 'anvil-0' }],
            },
        ]
        const r = combineHypothesisClusters(clusters, roomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.outliers.map((o) => (typeof o.identifier === 'string' ? o.identifier : ''))).toContain(
                'glue-1'
            )
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
        const clusters: ParsedCluster[] = [
            { clusterName: 'Only', members: [{ stableKey: 'glue-1' }] },
        ]
        const r = combineHypothesisClusters(clusters, roomMap, [{ stableKey: 'rope-0', intendedRole: prep }])
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.combined.outliers).toHaveLength(1)
            expect(r.combined.outliers[0].identifier).toBe('rope-0')
            expect(r.combined.outliers[0].intendedRole).toEqual(prep)
            const md = renderCombinedHypothesisForStageTwo(r.combined, roomMap)
            expect(md).toContain('**room:** VORTEX')
            expect(md).toContain('**intendedRole:** prep 0.71')
        }
    })
})
