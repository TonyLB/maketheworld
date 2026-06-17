import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from './baseClasses'
import {
    buildPositionAdjacencyDataCategory,
    EPHEMERA_POSITION_ADJACENCY_PREFIX,
    isEphemeraPositionAdjacencyRow,
    parseMembershipContainerFromAdjacencyQueryItem,
    parsePositionAdjacencyDataCategory,
} from './ephemeraPositionAdjacency'

const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const objectId = 'OBJECT#helmet' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId

describe('ephemeraPositionAdjacency key helpers', () => {
    it('buildPositionAdjacencyDataCategory prefixes host id', () => {
        expect(buildPositionAdjacencyDataCategory(roomId)).toBe('POSITION#ROOM#Cafe')
    })

    it('parsePositionAdjacencyDataCategory round-trips host room id', () => {
        const dataCategory = buildPositionAdjacencyDataCategory(roomId)
        expect(parsePositionAdjacencyDataCategory(dataCategory)).toBe(roomId)
    })

    it('parsePositionAdjacencyDataCategory rejects malformed SK', () => {
        expect(parsePositionAdjacencyDataCategory('POSITION#not-a-room')).toBeUndefined()
        expect(parsePositionAdjacencyDataCategory('Meta::Room')).toBeUndefined()
        expect(parsePositionAdjacencyDataCategory(`${EPHEMERA_POSITION_ADJACENCY_PREFIX}`)).toBeUndefined()
    })
})

describe('isEphemeraPositionAdjacencyRow', () => {
    it('accepts valid character adjacency row', () => {
        expect(isEphemeraPositionAdjacencyRow({
            EphemeraId: characterId,
            DataCategory: buildPositionAdjacencyDataCategory(roomId),
        })).toBe(true)
    })

    it('accepts valid object adjacency row', () => {
        expect(isEphemeraPositionAdjacencyRow({
            EphemeraId: objectId,
            DataCategory: buildPositionAdjacencyDataCategory(roomId),
        })).toBe(true)
    })

    it('rejects row with invalid contained id', () => {
        expect(isEphemeraPositionAdjacencyRow({
            EphemeraId: 'ROOM#Wrong',
            DataCategory: buildPositionAdjacencyDataCategory(roomId),
        })).toBe(false)
    })

    it('rejects row with malformed DataCategory', () => {
        expect(isEphemeraPositionAdjacencyRow({
            EphemeraId: characterId,
            DataCategory: 'POSITION#bad',
        })).toBe(false)
    })

    it('rejects row when EphemeraId is absent (query projection shape)', () => {
        expect(isEphemeraPositionAdjacencyRow({
            DataCategory: buildPositionAdjacencyDataCategory(roomId),
        })).toBe(false)
    })
})

describe('parseMembershipContainerFromAdjacencyQueryItem', () => {
    it('parses host room from DataCategory-only query item', () => {
        expect(parseMembershipContainerFromAdjacencyQueryItem({
            DataCategory: buildPositionAdjacencyDataCategory(roomId),
        })).toBe(roomId)
    })

    it('ignores malformed DataCategory', () => {
        expect(parseMembershipContainerFromAdjacencyQueryItem({
            DataCategory: 'POSITION#bad',
        })).toBeUndefined()
    })
})
