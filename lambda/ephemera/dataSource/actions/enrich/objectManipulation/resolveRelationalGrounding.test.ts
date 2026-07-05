import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { resolveRelationalGrounding } from './resolveRelationalGrounding'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId

describe('resolveRelationalGrounding', () => {
    it('resolves subject and target deterministically from room catalog', async () => {
        const result = await resolveRelationalGrounding(
            'put broom on table',
            'broom',
            'table',
            [
                { objectId: broomId, normalizedShortName: 'broom' },
                { objectId: tableId, normalizedShortName: 'table' },
            ]
        )

        expect(result).toEqual({
            type: 'success',
            subjectId: broomId,
            targetId: tableId,
        })
    })

    it('returns error when subject and target resolve to same object', async () => {
        const result = await resolveRelationalGrounding(
            'put broom on broom',
            'broom',
            'broom',
            [{ objectId: broomId, normalizedShortName: 'broom' }]
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.sameSubjectAndTarget,
        })
    })

    it('returns error when target span is not in room catalog', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: false,
        })

        const result = await resolveRelationalGrounding(
            'put broom on table',
            'broom',
            'table',
            [{ objectId: broomId, normalizedShortName: 'broom' }],
            { invokeBedrockObjectManipulationIdentityImpl }
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.identityInvokeFailed,
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalled()
    })
})
