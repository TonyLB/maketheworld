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
        expect(
            formatCoyoteAffinityPossibility({
                role: 'connect-props',
                aptness: 0.604,
            })
        ).toBe('connect-props 0.60')
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
            'plan roles: influence-road-runner 0.70; terminal 0.50'
        )
    })

    it('formats trope affinities before legacy roles when both are present', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Magnet',
            stableKey: 'magnet',
            tropeAffinities: [{
                trope: 'Contraption',
                aptness: 'High',
                narrowing: 'overhead winch',
            }],
            affinities: [{ role: 'delivery', aptness: 0.62 }],
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe(
            'tropes: Contraption High (overhead winch) | plan roles: delivery 0.62'
        )
    })

    it('includes both failure markers when both trope and legacy paths failed', () => {
        const o: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Box',
            stableKey: 'box',
            tropeAffinitiesFailed: true,
            affinitiesFailed: true,
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe(
            'trope affinities unavailable (enrich failed) | plan roles unavailable (enrich failed)'
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

    it('renders trope-first then legacy role text in staged line', () => {
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
                    affinities: [{ role: 'delivery', aptness: 0.55 }],
                },
            ],
        })
        expect(out).toContain(
            'magnet — stableKey: magnet — tropes: Contraption Good (ceiling track) | plan roles: delivery 0.55'
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
