import { describe, it, expect } from '@jest/globals'
import {
    listGraphCharacterIds,
    listRowCharacterIds,
    roomHasOccupancyDrift,
} from './classification'

const roomId = 'ROOM#alpha'
const characterId = 'CHARACTER#one'

const graphWithCharacter = {
    rootId: roomId, ports: [],
    // Concepts clause 3 requires the root to be present in `nodes`.
    nodes: [
        { tag: 'Room' as const, universalKey: roomId },
        { tag: 'Character' as const, universalKey: characterId, hostingKind: 'In' as const },
    ],
}

describe('listGraphCharacterIds', () => {
    it('extracts character ids from a stored ludicGraph', () => {
        expect(listGraphCharacterIds(graphWithCharacter)).toEqual([characterId])
    })

    it('returns empty array for invalid or missing graph', () => {
        expect(listGraphCharacterIds(undefined)).toEqual([])
        expect(listGraphCharacterIds({ nodes: 'bad' })).toEqual([])
        expect(listGraphCharacterIds({ nodes: [] })).toEqual([])
    })
})

describe('listRowCharacterIds', () => {
    it('lists the characters a characters row holds, ignoring key attributes', () => {
        expect(listRowCharacterIds({ EphemeraId: roomId, DataCategory: 'LudicCache::Characters', [characterId]: ['PRESENCE#a'], 'CHARACTER#two': [] })).toEqual([characterId, 'CHARACTER#two'])
    })

    it('returns empty for a missing or malformed row', () => {
        expect(listRowCharacterIds(undefined)).toEqual([])
        expect(listRowCharacterIds({ [characterId]: 'not a list' })).toEqual([])
    })
})

describe('roomHasOccupancyDrift', () => {
    it('flags a room whose stored graph still names a character, though everything else aligns (needs migration)', () => {
        expect(roomHasOccupancyDrift({
            roomId,
            rowCharacterIds: [characterId],
            legacyGraphCharacterIds: [characterId],
            adjacencySessionsByCharacter: new Map([[characterId, new Set(['sess-1'])]]),
            membershipContainersByCharacter: new Map([[characterId, [roomId]]]),
        })).toBe(true)
    })

    it('flags drift when a row character has no live sessions (ghost on the row)', () => {
        expect(roomHasOccupancyDrift({
            roomId,
            rowCharacterIds: [characterId],
            adjacencySessionsByCharacter: new Map(),
            membershipContainersByCharacter: new Map(),
        })).toBe(true)
    })

    it('flags drift when in-play row character is missing roomId in membership adjacency', () => {
        const adjacencySessionsByCharacter = new Map<string, Set<string>>([
            [characterId, new Set(['sess-1'])],
        ])
        expect(roomHasOccupancyDrift({
            roomId,
            rowCharacterIds: [characterId],
            adjacencySessionsByCharacter,
            membershipContainersByCharacter: new Map([[characterId, []]]),
        })).toBe(true)

        expect(roomHasOccupancyDrift({
            roomId,
            rowCharacterIds: [characterId],
            adjacencySessionsByCharacter,
            membershipContainersByCharacter: new Map([[characterId, ['ROOM#other']]]),
        })).toBe(true)
    })

    it('returns false for a clean room (sessions present and adjacency includes roomId)', () => {
        const adjacencySessionsByCharacter = new Map<string, Set<string>>([
            [characterId, new Set(['sess-1'])],
        ])
        expect(roomHasOccupancyDrift({
            roomId,
            rowCharacterIds: [characterId],
            adjacencySessionsByCharacter,
            membershipContainersByCharacter: new Map([[characterId, [roomId]]]),
        })).toBe(false)
    })

    it('returns false when the row lists no character', () => {
        expect(roomHasOccupancyDrift({
            roomId,
            rowCharacterIds: [],
            adjacencySessionsByCharacter: new Map([[characterId, new Set(['sess-1'])]]),
            membershipContainersByCharacter: new Map([[characterId, [roomId]]]),
        })).toBe(false)
    })

    it('explicit gap: stale adjacency without a row entry is not visible to room-forward scan', () => {
        // Orphan reverse index for roomId would not be visited when graphCharacterIds is empty.
        expect(roomHasOccupancyDrift({
            roomId,
            rowCharacterIds: [],
            adjacencySessionsByCharacter: new Map(),
            membershipContainersByCharacter: new Map(),
        })).toBe(false)
    })
})
