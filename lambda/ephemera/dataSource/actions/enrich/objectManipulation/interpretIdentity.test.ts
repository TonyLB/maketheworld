import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { interpretObjectManipulationIdentityBody } from './interpretIdentity'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const allowed = new Set([broomId, anvilId])

describe('interpretObjectManipulationIdentityBody', () => {
    it('accepts valid objectId JSON', () => {
        expect(interpretObjectManipulationIdentityBody(
            `{"objectId":"${broomId}"}`,
            allowed
        )).toEqual({
            success: true,
            response: { objectId: broomId },
        })
    })

    it('rejects objectId not in catalog', () => {
        const parsed = interpretObjectManipulationIdentityBody(
            '{"objectId":"OBJECT#Unknown"}',
            allowed
        )
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe('Object manipulation identity objectId is not in catalog')
        }
    })

    it('rejects forbidden routing fields', () => {
        const parsed = interpretObjectManipulationIdentityBody(
            `{"objectId":"${broomId}","roomId":"ROOM#X"}`,
            allowed
        )
        expect(parsed.success).toBe(false)
    })

    it('rejects missing objectId', () => {
        const parsed = interpretObjectManipulationIdentityBody('{}', allowed)
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe('Object manipulation identity requires objectId')
        }
    })

    it('rejects invalid JSON', () => {
        const parsed = interpretObjectManipulationIdentityBody('not json', allowed)
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe(objectManipulationErrorMessages.identityParseFailed)
        }
    })
})
