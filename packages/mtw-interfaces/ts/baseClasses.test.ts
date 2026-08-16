import { isEphemeraRoomId, isEphemeraAreaId, IMPROVISATION_ASSET_ID, isImprovisationAssetId } from './baseClasses'

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

describe('improvisation asset id', () => {
    it('recognizes IMPROVISATION_ASSET_ID', () => {
        expect(isImprovisationAssetId(IMPROVISATION_ASSET_ID)).toBe(true)
        expect(isImprovisationAssetId('ASSET#Base')).toBe(false)
    })
})