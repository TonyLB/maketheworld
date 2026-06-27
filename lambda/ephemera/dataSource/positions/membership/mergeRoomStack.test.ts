import { mergeRoomStack } from './mergeRoomStack'

const T1 = 1_700_000_000_000
const T2 = 1_700_000_000_100
const T3 = 1_700_000_000_200
const T_C = 1_700_000_000_100
const T_D = 1_700_000_000_200

const frame = (asset: string, RoomId: string, timeWritten?: number) => ({
    asset,
    RoomId,
    ...(timeWritten !== undefined ? { timeWritten } : {}),
})

describe('mergeRoomStack', () => {
    it('does not regress when a stale navigate arrives after a newer one (C then D, stale C last)', () => {
        const current = [
            frame('primitives', 'VORTEX', T1),
            frame('TownCenter', 'TownSquare', T1),
            frame('draftOne', 'RoomD', T_D),
        ]
        const proposed = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'TownSquare'),
            frame('draftOne', 'RoomC'),
        ]

        const merged = mergeRoomStack(current, proposed, T_C)
        expect(merged[2]).toEqual(frame('draftOne', 'RoomD', T_D))
    })

    it('applies timestamps on a fresh navigate over legacy rows without timeWritten', () => {
        const current = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'TownSquare'),
        ]
        const proposed = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'NewRoom'),
        ]

        expect(mergeRoomStack(current, proposed, T2)).toEqual([
            frame('primitives', 'VORTEX', T2),
            frame('TownCenter', 'NewRoom', T2),
        ])
    })

    it('keeps outer frames on fork truncate when their timeWritten is newer than writeTime', () => {
        const current = [
            frame('primitives', 'VORTEX', T1),
            frame('TownCenter', 'TownSquare', T2),
            frame('draftOne', 'Laboratory', T3),
        ]
        const proposed = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'Suburbs'),
        ]

        expect(mergeRoomStack(current, proposed, T2)).toEqual([
            frame('primitives', 'VORTEX', T2),
            frame('TownCenter', 'Suburbs', T2),
            frame('draftOne', 'Laboratory', T3),
        ])
    })

    it('drops outer frames on fork truncate when writeTime is at least as new as their timeWritten', () => {
        const current = [
            frame('primitives', 'VORTEX', T1),
            frame('TownCenter', 'TownSquare', T2),
            frame('draftOne', 'Laboratory', T3),
        ]
        const proposed = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'Suburbs'),
        ]

        expect(mergeRoomStack(current, proposed, T3)).toEqual([
            frame('primitives', 'VORTEX', T3),
            frame('TownCenter', 'Suburbs', T3),
        ])
    })

    it('blocks stale resurrection of truncated outer layers', () => {
        const current = [
            frame('primitives', 'VORTEX', T1),
            frame('TownCenter', 'TownSquare', T_D),
        ]
        const proposed = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'TownSquare'),
            frame('draftOne', 'RoomC'),
        ]

        const merged = mergeRoomStack(current, proposed, T_C)
        expect(merged).toHaveLength(2)
        expect(merged.every(({ asset }) => asset !== 'draftOne')).toBe(true)
    })

    it('treats missing timeWritten as 0 for legacy rows', () => {
        const current = [frame('primitives', 'VORTEX')]
        const proposed = [frame('primitives', 'VORTEX'), frame('TownCenter', 'TownSquare')]

        expect(mergeRoomStack(current, proposed, 100)).toEqual([
            frame('primitives', 'VORTEX', 100),
            frame('TownCenter', 'TownSquare', 100),
        ])
    })

    it('applies proposed when writeTime equals the frame timeWritten', () => {
        const current = [
            frame('primitives', 'VORTEX', T1),
            frame('TownCenter', 'OldRoom', T2),
        ]
        const proposed = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'NewRoom'),
        ]

        expect(mergeRoomStack(current, proposed, T2)).toEqual([
            frame('primitives', 'VORTEX', T2),
            frame('TownCenter', 'NewRoom', T2),
        ])
    })

    it('chains merges so a newer navigate followed by a stale one leaves the newer stack', () => {
        const legacy = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'TownSquare'),
        ]
        const proposedC = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'TownSquare'),
            frame('draftOne', 'RoomC'),
        ]
        const proposedD = [
            frame('primitives', 'VORTEX'),
            frame('TownCenter', 'TownSquare'),
            frame('draftOne', 'RoomD'),
        ]

        const afterD = mergeRoomStack(legacy, proposedD, T_D)
        const afterStaleC = mergeRoomStack(afterD, proposedC, T_C)

        expect(afterStaleC).toEqual(afterD)
        expect(afterStaleC[2]).toEqual(frame('draftOne', 'RoomD', T_D))
    })
})
