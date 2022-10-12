import { isEphemeraRoomId } from './ephemera'

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