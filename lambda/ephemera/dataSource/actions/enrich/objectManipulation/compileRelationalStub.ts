import type { ParseCommandErrorResult } from '../../baseClasses'

import type { ManipulationFrame } from './manipulationFrame'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type RelationalCompileStubOutcome = {
    type: 'stub'
    frame: ManipulationFrame
}

export function compileRelationalStub(
    frame: ManipulationFrame,
    _intentConfidence: number
): ParseCommandErrorResult {
    void frame
    return {
        type: 'Error',
        errorMessage: objectManipulationErrorMessages.complexRelational,
    }
}
