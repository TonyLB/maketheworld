import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteStagedObject } from './coyoteRoomObjectSnapshot'
import {
    formatCoyoteObjectAffinitySuffix,
    formatCoyoteStagedObjectsByRoom,
} from './coyoteRoomObjectSnapshot'

const room = (id: string): EphemeraRoomId => id as EphemeraRoomId

describe('formatCoyoteObjectAffinitySuffix', () => {
    it('returns empty for object without trope metadata', () => {
        const o: CoyoteStagedObject = {
            objectId: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Anvil',
            stableKey: 'anvil',
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe('')
    })

    it('returns failure note when tropeAffinitiesFailed', () => {
        const o: CoyoteStagedObject = {
            objectId: 'OBJECT#a' as `OBJECT#${string}`,
            shortName: 'Box',
            stableKey: 'box',
            tropeAffinitiesFailed: true,
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe('trope affinities unavailable (enrich failed)')
    })

    it('formats trope affinities when present', () => {
        const o: CoyoteStagedObject = {
            objectId: 'OBJECT#a' as `OBJECT#${string}`,
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

    it('formats Scene Dressing trope affinities', () => {
        const o: CoyoteStagedObject = {
            objectId: 'OBJECT#h' as `OBJECT#${string}`,
            shortName: 'helmet',
            stableKey: 'helmet',
            tropeAffinities: [{
                trope: 'Scene Dressing',
                aptness: 'Good',
                narrowing: 'protective equipment',
            }],
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe(
            'tropes: Scene Dressing Good (protective equipment)'
        )
    })

    it('formats mixed Scene Dressing and causal tropes on one object', () => {
        const o: CoyoteStagedObject = {
            objectId: 'OBJECT#s' as `OBJECT#${string}`,
            shortName: 'rocket skates',
            stableKey: 'rocket-skates',
            tropeAffinities: [
                { trope: 'Contraption', aptness: 'High', narrowing: 'coyote mobility rig' },
                { trope: 'Scene Dressing', aptness: 'Good', narrowing: 'racing gear' },
            ],
        }
        expect(formatCoyoteObjectAffinitySuffix(o)).toBe(
            'tropes: Contraption High (coyote mobility rig); Scene Dressing Good (racing gear)'
        )
    })

    it('ignores optional trope environmentAffordances in formatted suffix text', () => {
        const o: CoyoteStagedObject = {
            objectId: 'OBJECT#a' as `OBJECT#${string}`,
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
        const o: CoyoteStagedObject = {
            objectId: 'OBJECT#a' as `OBJECT#${string}`,
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
            [room('ROOM#VORTEX')]: [{ objectId: 'OBJECT#x' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil' }],
        })
        expect(out).toBe('CLIFFBASE:\n  anvil — stableKey: anvil')
    })

    it('includes failure note per object', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [
                {
                    objectId: 'OBJECT#x' as `OBJECT#${string}`,
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
                    objectId: 'OBJECT#x' as `OBJECT#${string}`,
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

    it('renders Scene Dressing in staged line', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#VORTEX')]: [
                {
                    objectId: 'OBJECT#g' as `OBJECT#${string}`,
                    shortName: 'goggles',
                    stableKey: 'goggles',
                    tropeAffinities: [{
                        trope: 'Scene Dressing',
                        aptness: 'Good',
                        narrowing: 'racing gear',
                    }],
                },
            ],
        })
        expect(out).toContain(
            'goggles — stableKey: goggles — tropes: Scene Dressing Good (racing gear)'
        )
    })

    it('sorts rooms by id', () => {
        const out = formatCoyoteStagedObjectsByRoom({
            [room('ROOM#Z')]: [{ objectId: 'OBJECT#z' as `OBJECT#${string}`, shortName: 'z', stableKey: 'z' }],
            [room('ROOM#A')]: [{ objectId: 'OBJECT#a' as `OBJECT#${string}`, shortName: 'a', stableKey: 'a' }],
        })
        expect(out.indexOf('A:')).toBeLessThan(out.indexOf('Z:'))
    })
})
