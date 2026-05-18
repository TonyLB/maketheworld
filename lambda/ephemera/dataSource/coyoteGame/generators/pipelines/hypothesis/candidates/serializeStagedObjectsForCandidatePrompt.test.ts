import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'
import { serializeStagedObjectsAffinityForwardJson } from './serializeStagedObjectsForCandidatePrompt'

const room = (id: string): EphemeraRoomId => id as EphemeraRoomId

describe('serializeStagedObjectsAffinityForwardJson', () => {
    it('returns deterministic stableKey ordering with full nested affordances under tropeAffinities', () => {
        const first = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#Z')]: [{
                uuid: 'OBJECT#z' as `OBJECT#${string}`,
                shortName: 'z',
                stableKey: 'z',
            }],
            [room('ROOM#A')]: [{
                uuid: 'OBJECT#a' as `OBJECT#${string}`,
                shortName: 'a',
                stableKey: 'a',
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'chain rig',
                    environmentAffordances: [{ object: 'boulder', roles: ['Finishing Move', 'Contraption'] }],
                }],
            }],
        })
        const second = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#Z')]: [{
                uuid: 'OBJECT#z' as `OBJECT#${string}`,
                shortName: 'z',
                stableKey: 'z',
            }],
            [room('ROOM#A')]: [{
                uuid: 'OBJECT#a' as `OBJECT#${string}`,
                shortName: 'a',
                stableKey: 'a',
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'chain rig',
                    environmentAffordances: [{ object: 'boulder', roles: ['Finishing Move', 'Contraption'] }],
                }],
            }],
        })
        expect(first).toBe(second)
        const parsed = JSON.parse(first) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
            objects: Array<{
                stableKey: string
                room: string
                tropeAffinities?: Array<{ environmentAffordances?: unknown[] }>
            }>
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual(['a'])
        expect(parsed.objects.map((o) => o.stableKey)).toEqual(['a', 'z'])
        expect(parsed.objects[0].room).toBe('A')
        expect(parsed.objects[0].tropeAffinities?.[0].environmentAffordances).toEqual([
            { object: 'boulder', roles: ['Finishing Move', 'Contraption'] },
        ])
        expect(JSON.stringify(first)).not.toContain('roomId')
    })

    it('lists expanderStableKeys for multi non-poor affinities; omits failed or empty affinity objects', () => {
        const map: CoyoteRoomObjectsByRoom = {
            [room('ROOM#VORTEX')]: [
                {
                    uuid: 'OBJECT#m' as `OBJECT#${string}`,
                    shortName: 'multi',
                    stableKey: 'multi-0',
                    tropeAffinities: [
                        { trope: 'Contraption', aptness: 'High', narrowing: 'a' },
                        { trope: 'Finishing Move', aptness: 'Good', narrowing: 'b' },
                    ],
                },
                {
                    uuid: 'OBJECT#u' as `OBJECT#${string}`,
                    shortName: 'none',
                    stableKey: 'none-1',
                    tropeAffinities: [],
                },
                {
                    uuid: 'OBJECT#f' as `OBJECT#${string}`,
                    shortName: 'fail',
                    stableKey: 'fail-2',
                    tropeAffinitiesFailed: true,
                },
            ],
        }
        const json = serializeStagedObjectsAffinityForwardJson(map)
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual(['multi-0'])
    })

    it('lists anchorStableKeys for single High with optional Poor satellites and no affordances on High', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#c' as `OBJECT#${string}`,
                shortName: 'catapult',
                stableKey: 'catapult-0',
                tropeAffinities: [
                    { trope: 'Contraption', aptness: 'High', narrowing: 'launcher' },
                    { trope: 'Finishing Move', aptness: 'Poor', narrowing: 'weak alternate' },
                ],
            }],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual(['catapult-0'])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual([])
    })

    it('lists expanderStableKeys when only affordances attach to a non-Poor row (single Good)', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#g' as `OBJECT#${string}`,
                shortName: 'gizmo',
                stableKey: 'gizmo-1',
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'rig',
                    environmentAffordances: [{ object: 'boulder', roles: ['Contraption'] }],
                }],
            }],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual(['gizmo-1'])
    })

    it('places neither anchor nor expander for single Good without affordances', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#w' as `OBJECT#${string}`,
                shortName: 'weak',
                stableKey: 'weak-2',
                tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'maybe' }],
            }],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual([])
    })

    it('ignores affordances attached only to Poor rows for bucketing', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#p' as `OBJECT#${string}`,
                shortName: 'poor-only',
                stableKey: 'poor-3',
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'Poor',
                    narrowing: 'discard',
                    environmentAffordances: [{ object: 'boulder', roles: ['Contraption'] }],
                }],
            }],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual([])
    })

    it('lists expanderStableKeys for single Good Scene Dressing only (no causal non-Poor)', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#h' as `OBJECT#${string}`,
                shortName: 'helmet',
                stableKey: 'helmet-0',
                tropeAffinities: [{
                    trope: 'Scene Dressing',
                    aptness: 'Good',
                    narrowing: 'protective equipment',
                }],
            }],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual(['helmet-0'])
    })

    it('lists expanderStableKeys for clean-001 dressing props (helmet and goggles Scene Dressing only)', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#STRAIGHTAWAY')]: [
                {
                    uuid: 'OBJECT#rs' as `OBJECT#${string}`,
                    shortName: 'rocket skates',
                    stableKey: 'rocket-skates-0',
                    tropeAffinities: [{
                        trope: 'Contraption',
                        aptness: 'High',
                        narrowing: 'coyote mobility or pursuit rig',
                    }],
                },
                {
                    uuid: 'OBJECT#h' as `OBJECT#${string}`,
                    shortName: 'helmet',
                    stableKey: 'helmet-0',
                    tropeAffinities: [{
                        trope: 'Scene Dressing',
                        aptness: 'Good',
                        narrowing: 'protective equipment',
                    }],
                },
                {
                    uuid: 'OBJECT#g' as `OBJECT#${string}`,
                    shortName: 'goggles',
                    stableKey: 'goggles-0',
                    tropeAffinities: [{
                        trope: 'Scene Dressing',
                        aptness: 'Good',
                        narrowing: 'racing gear',
                    }],
                },
            ],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual(['rocket-skates-0'])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual(['goggles-0', 'helmet-0'])
    })

    it('lists expanderStableKeys for mixed Contraption High plus Scene Dressing Good on one prop', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#m' as `OBJECT#${string}`,
                shortName: 'mixed',
                stableKey: 'mixed-0',
                tropeAffinities: [
                    { trope: 'Contraption', aptness: 'High', narrowing: 'mobility rig' },
                    { trope: 'Scene Dressing', aptness: 'Good', narrowing: 'racing gear' },
                ],
            }],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual(['mixed-0'])
    })

    it('places neither anchor nor expander for Scene Dressing Poor only', () => {
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#p' as `OBJECT#${string}`,
                shortName: 'costume',
                stableKey: 'costume-0',
                tropeAffinities: [{
                    trope: 'Scene Dressing',
                    aptness: 'Poor',
                    narrowing: 'weak thematic read',
                }],
            }],
        })
        const parsed = JSON.parse(json) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual([])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual([])
    })

    it('round-trips affordancesProvided nested under tropeAffinities', () => {
        const affordancesProvided = [
            { object: 'hidden catapult', intended: true as const, roles: ['Contraption' as const] },
        ]
        const json = serializeStagedObjectsAffinityForwardJson({
            [room('ROOM#VORTEX')]: [{
                uuid: 'OBJECT#ap' as `OBJECT#${string}`,
                shortName: 'kit',
                stableKey: 'kit',
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'rig',
                    environmentAffordances: [{ object: 'boulder', roles: ['Contraption'] }],
                    affordancesProvided,
                }],
            }],
        })
        const parsed = JSON.parse(json) as {
            objects: Array<{ tropeAffinities?: Array<{
                environmentAffordances?: unknown[]
                affordancesProvided?: typeof affordancesProvided
            }> }>
        }
        expect(parsed.objects[0].tropeAffinities?.[0].environmentAffordances).toEqual([
            { object: 'boulder', roles: ['Contraption'] },
        ])
        expect(parsed.objects[0].tropeAffinities?.[0].affordancesProvided).toEqual(affordancesProvided)
    })
})
