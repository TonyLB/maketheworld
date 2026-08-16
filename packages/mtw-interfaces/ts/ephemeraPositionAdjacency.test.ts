import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from './baseClasses'
import {
    buildPositionAdjacencyDataCategory,
    EPHEMERA_POSITION_ADJACENCY_PREFIX,
    isEphemeraPositionAdjacencyRow,
    parseMembershipContainerFromAdjacencyQueryItem,
    parsePositionAdjacencyDataCategory,
} from './ephemeraPositionAdjacency'

const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const characterHostId = 'CHARACTER#Beta' as EphemeraCharacterId
const objectId = 'OBJECT#helmet' as EphemeraObjectId
const objectHostId = 'OBJECT#Box' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const featureId = 'FEATURE#Niche' as EphemeraFeatureId
const featureHostId = 'FEATURE#Wall' as EphemeraFeatureId
const areaHostId = 'AREA#Downtown' as EphemeraAreaId

describe('ephemeraPositionAdjacency key helpers', () => {
    it('buildPositionAdjacencyDataCategory prefixes room host id', () => {
        expect(buildPositionAdjacencyDataCategory(roomId)).toBe('POSITION#ROOM#Cafe')
    })

    it('buildPositionAdjacencyDataCategory prefixes character host id', () => {
        expect(buildPositionAdjacencyDataCategory(characterHostId)).toBe('POSITION#CHARACTER#Beta')
    })

    it('buildPositionAdjacencyDataCategory prefixes object host id', () => {
        expect(buildPositionAdjacencyDataCategory(objectHostId)).toBe('POSITION#OBJECT#Box')
    })

    it('buildPositionAdjacencyDataCategory prefixes feature host id', () => {
        expect(buildPositionAdjacencyDataCategory(featureHostId)).toBe('POSITION#FEATURE#Wall')
    })

    it('buildPositionAdjacencyDataCategory prefixes area host id', () => {
        expect(buildPositionAdjacencyDataCategory(areaHostId)).toBe('POSITION#AREA#Downtown')
    })

    it('parsePositionAdjacencyDataCategory round-trips host room id', () => {
        const dataCategory = buildPositionAdjacencyDataCategory(roomId)
        expect(parsePositionAdjacencyDataCategory(dataCategory)).toBe(roomId)
    })

    it('parsePositionAdjacencyDataCategory round-trips character host id', () => {
        const dataCategory = buildPositionAdjacencyDataCategory(characterHostId)
        expect(parsePositionAdjacencyDataCategory(dataCategory)).toBe(characterHostId)
    })

    it('parsePositionAdjacencyDataCategory round-trips object host id', () => {
        const dataCategory = buildPositionAdjacencyDataCategory(objectHostId)
        expect(parsePositionAdjacencyDataCategory(dataCategory)).toBe(objectHostId)
    })

    it('parsePositionAdjacencyDataCategory round-trips feature host id', () => {
        const dataCategory = buildPositionAdjacencyDataCategory(featureHostId)
        expect(parsePositionAdjacencyDataCategory(dataCategory)).toBe(featureHostId)
    })

    it('parsePositionAdjacencyDataCategory round-trips area host id', () => {
        const dataCategory = buildPositionAdjacencyDataCategory(areaHostId)
        expect(parsePositionAdjacencyDataCategory(dataCategory)).toBe(areaHostId)
    })

    it('parsePositionAdjacencyDataCategory rejects malformed SK', () => {
        expect(parsePositionAdjacencyDataCategory('POSITION#not-a-room')).toBeUndefined()
        // NOTE: 'OBJECT#held' is now a legal host (LP0 widened EphemeraMembershipHostId to
        // include Object), so this no longer exercises a rejection --- KNOWLEDGE is not an
        // eligible host tag and stands in for "well-formed tagged id, wrong tag" instead.
        expect(parsePositionAdjacencyDataCategory('POSITION#KNOWLEDGE#held')).toBeUndefined()
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

    it('accepts valid object adjacency row on character host', () => {
        expect(isEphemeraPositionAdjacencyRow({
            EphemeraId: objectId,
            DataCategory: buildPositionAdjacencyDataCategory(characterHostId),
        })).toBe(true)
    })

    it('accepts valid feature-contained adjacency row on feature host (LD-8: FEATURE#Wall hosts FEATURE#Niche)', () => {
        expect(isEphemeraPositionAdjacencyRow({
            EphemeraId: featureId,
            DataCategory: buildPositionAdjacencyDataCategory(featureHostId),
        })).toBe(true)
    })

    it('accepts valid object adjacency row on object host (recursive hosting)', () => {
        expect(isEphemeraPositionAdjacencyRow({
            EphemeraId: objectId,
            DataCategory: buildPositionAdjacencyDataCategory(objectHostId),
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

    it('parses character host from DataCategory-only query item', () => {
        expect(parseMembershipContainerFromAdjacencyQueryItem({
            DataCategory: buildPositionAdjacencyDataCategory(characterHostId),
        })).toBe(characterHostId)
    })

    it('ignores malformed DataCategory', () => {
        expect(parseMembershipContainerFromAdjacencyQueryItem({
            DataCategory: 'POSITION#bad',
        })).toBeUndefined()
    })
})
