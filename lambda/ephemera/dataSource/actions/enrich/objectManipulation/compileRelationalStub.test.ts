import { compileRelationalStub } from './compileRelationalStub'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

describe('compileRelationalStub', () => {
    it('returns terminal Error with complexRelational message for enum relation', () => {
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

    it('returns nestingRelational Error for containment relationSpan', () => {
        const result = compileRelationalStub(
            {
                command: 'put coin in jar',
                subjectSpan: 'coin',
                targetSpan: 'jar',
                relationSpan: 'in',
                verbClass: 'release',
                rawObjectSpans: ['coin'],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        })
    })
})
