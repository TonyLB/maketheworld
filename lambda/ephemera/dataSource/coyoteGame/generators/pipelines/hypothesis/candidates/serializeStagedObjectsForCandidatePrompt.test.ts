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
            decisionFocus: { ambiguousStableKeys: string[]; unassignedStableKeys: string[] }
            objects: Array<{
                stableKey: string
                room: string
                tropeAffinities?: Array<{ environmentAffordances?: unknown[] }>
            }>
        }
        expect(parsed.objects.map((o) => o.stableKey)).toEqual(['a', 'z'])
        expect(parsed.objects[0].room).toBe('A')
        expect(parsed.objects[0].tropeAffinities?.[0].environmentAffordances).toEqual([
            { object: 'boulder', roles: ['Finishing Move', 'Contraption'] },
        ])
        expect(JSON.stringify(first)).not.toContain('roomId')
    })

    it('lists ambiguousStableKeys for multi-affinity objects and unassignedStableKeys for empty or failed', () => {
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
            decisionFocus: { ambiguousStableKeys: string[]; unassignedStableKeys: string[] }
        }
        expect(parsed.decisionFocus.ambiguousStableKeys).toEqual(['multi-0'])
        expect(parsed.decisionFocus.unassignedStableKeys).toEqual(['fail-2', 'none-1'])
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
