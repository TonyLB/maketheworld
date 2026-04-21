import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    formatCoyoteAffinityPossibility,
    formatCoyoteObjectAffinitySuffix,
    formatCoyoteStagedObjectsByRoom,
} from './coyoteRoomObjectSnapshot'

const room = (id: string): EphemeraRoomId => id as EphemeraRoomId

describe('formatCoyoteAffinityPossibility', () => {
    it('formats flat modification tags', () => {
        expect(
            formatCoyoteAffinityPossibility({
                role: 'influence-road-runner',
                aptness: 0.712,
            })
        ).toBe('influence-road-runner 0.71')
    })

    it('formats structural role', () => {
        expect(formatCoyoteAffinityPossibility({ role: 'terminal', aptness: 0.5 })).toBe('terminal 0.50')
    })

    it('formats generative roles', () => {
        expect(formatCoyoteAffinityPossibility({ role: 'prep', aptness: 0.64 })).toBe('prep 0.64')
        expect(formatCoyoteAffinityPossibility({ role: 'creation', aptness: 0.33 })).toBe('creation 0.33')
    })
})

describe('formatCoyoteObjectAffinitySuffix', () => {
    it('returns empty for legacy object without affinities', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Anvil',
            stableKey: 'anvil',
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe('')
    })

    it('returns failure note when affinitiesFailed', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Box',
            stableKey: 'box',
            affinitiesFailed: true,
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe('plan roles unavailable (enrich failed)')
    })

    it('formats affinities sorted by aptness descending', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Beehive',
            stableKey: 'beehive',
            affinities: [
                { role: 'terminal', aptness: 0.5 },
                {
                    role: 'influence-road-runner',
                    aptness: 0.7,
                },
            ],
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe(
            'influence-road-runner 0.70; terminal 0.50'
        )
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
        expect(out).toBe('VORTEX: (none)')
    })

    it('lists legacy object with stableKey line', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [{ uuid: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil' }],
        })
        expect(out).toBe('VORTEX:\n  anvil — stableKey: anvil')
    })

    it('includes failure note per object', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [
                {
                    uuid: 'OBJECT#x' as `OBJECT#${string}`,
                    shortName: 'paint',
                    stableKey: 'paint',
                    affinitiesFailed: true,
                },
            ],
        })
        expect(out).toContain('paint — stableKey: paint — plan roles unavailable (enrich failed)')
    })

    it('sorts rooms by id', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#Z')]: [{ uuid: 'OBJECT#z' as `OBJECT#${string}`, shortName: 'z', stableKey: 'z' }],
            [room('ROOM#A')]: [{ uuid: 'OBJECT#a' as `OBJECT#${string}`, shortName: 'a', stableKey: 'a' }],
        })
        expect(out.indexOf('A:')).toBeLessThan(out.indexOf('Z:'))
    })
})
