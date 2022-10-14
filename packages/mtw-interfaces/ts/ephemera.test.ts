import { isEphemeraAPIMessage } from './ephemera'

describe('EphemeraAPIMessage typeguard', () => {

    it('should reject non-object entry', () => {
        expect(isEphemeraAPIMessage([{
            message: 'action',
            actionType: 'home',
            payload: { CharacterId: 'CHARACTER#TestABC' }
        }])).toBe(false)
    })

    it('should reject object without message field', () => {
        expect(isEphemeraAPIMessage({
            massage: 'action',
            actionType: 'home',
            payload: { CharacterId: 'CHARACTER#TestABC' }
        })).toBe(false)
    })

    describe('registercharacter', () => {

        it('should reject when no CharacterId', () => {
            expect(isEphemeraAPIMessage({
                message: 'registercharacter',
                PersonId: 'CHARACTER#Test'
            })).toBe(false)
        })

        it('should reject when wrong type CharacterId', () => {
            expect(isEphemeraAPIMessage({
                message: 'registercharacter',
                CharacterId: 1234
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isEphemeraAPIMessage({
                message: 'registercharacter',
                CharacterId: 'CHARACTER#TestABC'
            })).toBe(true)
        })

    })

    describe('action', () => {

        it('should reject when no actionType', () => {
            expect(isEphemeraAPIMessage({
                message: 'action'
            })).toBe(false)
        })

        it('should reject when bad payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'home',
                payload: 'CHARACTER#TestABC'
            })).toBe(false)
        })

        it('should reject mistyped look CharacterId payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'TestABC',
                    EphemeraId: 'ROOM#VORTEX'
                }
            })).toBe(false)
        })

        it('should reject mistyped look EphemeraId payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#TestABC',
                    EphemeraId: 'VORTEX'
                }
            })).toBe(false)
        })

        it('should accept correct look payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#TestABC',
                    EphemeraId: 'ROOM#VORTEX'
                }
            })).toBe(true)
        })

    })
})