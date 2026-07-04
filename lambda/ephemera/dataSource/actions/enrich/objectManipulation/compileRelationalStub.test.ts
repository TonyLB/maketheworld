import { compileRelationalStub } from './compileRelationalStub'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

describe('compileRelationalStub', () => {
    it('returns terminal Error with complexRelational message', () => {
        const result = compileRelationalStub(
            {
                command: 'put broom on table',
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
                verbClass: 'release',
                rawObjectSpans: ['broom'],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
    })
})
