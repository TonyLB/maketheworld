import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    formatCoyoteObjectAffinitySuffix,
    formatCoyoteStagedObjectsByRoom,
    serializeCoyoteStagedObjectsByRoomJson,
} from './coyoteRoomObjectSnapshot'

const room = (id: string): EphemeraRoomId => id as EphemeraRoomId

describe('formatCoyoteObjectAffinitySuffix', () => {
    it('returns empty for object without trope metadata', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Anvil',
            stableKey: 'anvil',
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe('')
    })

    it('returns failure note when tropeAffinitiesFailed', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Box',
            stableKey: 'box',
            tropeAffinitiesFailed: true,
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe('trope affinities unavailable (enrich failed)')
    })

    it('formats trope affinities when present', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Magnet',
            stableKey: 'magnet',
            tropeAffinities: [{
                trope: 'Contraption',
                aptness: 'High',
                narrowing: 'overhead winch',
            }],
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe(
            'tropes: Contraption High (overhead winch)'
        )
    })

    it('ignores optional trope environmentAffordances in formatted suffix text', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Magnet',
            stableKey: 'magnet',
            tropeAffinities: [
                {
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'overhead winch',
                    environmentAffordances: [{
                        object: 'boulder',
                        roles: ['Finishing Move'],
                    }],
                },
                {
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'chain rig',
                },
            ],
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe(
            'tropes: Contraption High (overhead winch); Contraption Good (chain rig)'
        )
    })

    it('includes trope failure marker', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Box',
            stableKey: 'box',
            tropeAffinitiesFailed: true,
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe('trope affinities unavailable (enrich failed)')
    })
})

describe('formatCoyoteStagedObjectsByRoom', () => {
    it('returns (none) for empty map', () => {
        expect(formatCoyoteStagedObjectsByRoom({})).toBe('(none)')
    })

    it('shows (none) for empty room', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [],
        })
        expect(out).toBe('CLIFFBASE: (none)')
    })

    it('lists legacy object with stableKey line', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [{ uuid: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil' }],
        })
        expect(out).toBe('CLIFFBASE:\n  anvil — stableKey: anvil')
    })

    it('includes failure note per object', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [
                {
                    uuid: 'OBJECT#x' as `OBJECT#${string}`,
                    shortName: 'paint',
                    stableKey: 'paint',
                    tropeAffinitiesFailed: true,
                },
            ],
        })
        expect(out).toContain('paint — stableKey: paint — trope affinities unavailable (enrich failed)')
    })

    it('renders trope text in staged line', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [
                {
                    uuid: 'OBJECT#x' as `OBJECT#${string}`,
                    shortName: 'magnet',
                    stableKey: 'magnet',
                    tropeAffinities: [{
                        trope: 'Contraption',
                        aptness: 'Good',
                        narrowing: 'ceiling track',
                    }],
                },
            ],
        })
        expect(out).toContain(
            'magnet — stableKey: magnet — tropes: Contraption Good (ceiling track)'
        )
    })

    it('sorts rooms by id', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#Z')]: [{ uuid: 'OBJECT#z' as `OBJECT#${string}`, shortName: 'z', stableKey: 'z' }],
            [room('ROOM#A')]: [{ uuid: 'OBJECT#a' as `OBJECT#${string}`, shortName: 'a', stableKey: 'a' }],
        })
        expect(out.indexOf('A:')).toBeLessThan(out.indexOf('Z:'))
    })
})

describe('serializeCoyoteStagedObjectsByRoomJson', () => {
    it('returns deterministic room ordering with full nested affordances', () => {
        const first = serializeCoyoteStagedObjectsByRoomJson({
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
        const second = serializeCoyoteStagedObjectsByRoomJson({
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
            rooms: Array<{
                roomId: string;
                room: string;
                objects: Array<{
                    stableKey: string;
                    tropeAffinities?: Array<{ environmentAffordances?: unknown[] }>;
                }>;
            }>;
        }
        expect(parsed.rooms.map(({ room }) => room)).toEqual(['A', 'Z'])
        expect(parsed.rooms[0].objects[0].tropeAffinities?.[0].environmentAffordances).toEqual([
            { object: 'boulder', roles: ['Finishing Move', 'Contraption'] },
        ])
    })
})
