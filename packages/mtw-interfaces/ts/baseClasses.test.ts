import { isEphemeraRoomId, isEphemeraAreaId, isEphemeraConceptId, isEphemeraId, IMPROVISATION_ASSET_ID, isImprovisationAssetId } from './baseClasses'

describe('EphemeraId functions', () => {
    it('should correctly flag a key', () => {
        expect(isEphemeraRoomId('ROOM#TestABC')).toBe(true)
    })
    it('should correctly reject a mistagged key', () => {
        expect(isEphemeraRoomId('VARIABLE#TestABC')).toBe(false)
    })
    it('should correctly reject a non-key', () => {
        expect(isEphemeraRoomId('TestABC')).toBe(false)
    })
    it('should throw an exception on nested key', () => {
        expect(() => (isEphemeraRoomId('ROOM#ROOM#TestABC'))).toThrowError()
    })
})

describe('EphemeraAreaId functions', () => {
    it('should correctly flag a key', () => {
        expect(isEphemeraAreaId('AREA#TestABC')).toBe(true)
    })
    it('should correctly reject a mistagged key', () => {
        expect(isEphemeraAreaId('VARIABLE#TestABC')).toBe(false)
    })
    it('should correctly reject a non-key', () => {
        expect(isEphemeraAreaId('TestABC')).toBe(false)
    })
    it('should throw an exception on nested key', () => {
        expect(() => (isEphemeraAreaId('AREA#AREA#TestABC'))).toThrowError()
    })
})

describe('EphemeraConceptId functions', () => {
    it('should correctly flag a key', () => {
        expect(isEphemeraConceptId('CONCEPT#TestABC')).toBe(true)
    })
    it('should correctly reject a mistagged key', () => {
        expect(isEphemeraConceptId('OBJECT#TestABC')).toBe(false)
    })
    it('should correctly reject a non-key', () => {
        expect(isEphemeraConceptId('TestABC')).toBe(false)
    })
    it('should throw an exception on nested key', () => {
        expect(() => (isEphemeraConceptId('CONCEPT#CONCEPT#TestABC'))).toThrowError()
    })
    it('is a first-class EphemeraId', () => {
        expect(isEphemeraId('CONCEPT#TestABC')).toBe(true)
    })
})

describe('improvisation asset id', () => {
    it('recognizes IMPROVISATION_ASSET_ID', () => {
        expect(isImprovisationAssetId(IMPROVISATION_ASSET_ID)).toBe(true)
        expect(isImprovisationAssetId('ASSET#Base')).toBe(false)
    })
})