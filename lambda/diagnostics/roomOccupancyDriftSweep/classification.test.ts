import { describe, it, expect } from '@jest/globals'
import {
    listGraphCharacterIds,
    roomHasOccupancyDrift,
} from './classification'

const roomId = 'ROOM#alpha'
const characterId = 'CHARACTER#one'

const graphWithCharacter = {
    nodes: [{ tag: 'Character' as const, universalKey: characterId }],
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

describe('roomHasOccupancyDrift', () => {
    it('flags drift when a graph character has no live sessions (ghost on graph)', () => {
        expect(roomHasOccupancyDrift({
            roomId,
            graphCharacterIds: [characterId],
            adjacencySessionsByCharacter: new Map(),
            membershipContainersByCharacter: new Map(),
        })).toBe(true)
    })

    it('flags drift when in-play graph character is missing roomId in membership adjacency', () => {
        const adjacencySessionsByCharacter = new Map<string, Set<string>>([
            [characterId, new Set(['sess-1'])],
        ])
        expect(roomHasOccupancyDrift({
            roomId,
            graphCharacterIds: [characterId],
            adjacencySessionsByCharacter,
            membershipContainersByCharacter: new Map([[characterId, []]]),
        })).toBe(true)

        expect(roomHasOccupancyDrift({
            roomId,
            graphCharacterIds: [characterId],
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
            graphCharacterIds: [characterId],
            adjacencySessionsByCharacter,
            membershipContainersByCharacter: new Map([[characterId, [roomId]]]),
        })).toBe(false)
    })

    it('returns false when the room graph has no character nodes', () => {
        expect(roomHasOccupancyDrift({
            roomId,
            graphCharacterIds: [],
            adjacencySessionsByCharacter: new Map([[characterId, new Set(['sess-1'])]]),
            membershipContainersByCharacter: new Map([[characterId, [roomId]]]),
        })).toBe(false)
    })

    it('explicit gap: stale adjacency without graph node is not visible to room-forward scan', () => {
        // Orphan reverse index for roomId would not be visited when graphCharacterIds is empty.
        expect(roomHasOccupancyDrift({
            roomId,
            graphCharacterIds: [],
            adjacencySessionsByCharacter: new Map(),
            membershipContainersByCharacter: new Map(),
        })).toBe(false)
    })
})
