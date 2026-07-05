import type { ParseCommandErrorResult } from '../../baseClasses'

import type { ManipulationFrame } from './manipulationFrame'
import { normalizeRelationSpan } from './normalizeRelationSpan'
import type { NormalizedRelation } from './relationKind'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type RelationalCompileStubOutcome = {
    type: 'stub'
    frame: ManipulationFrame
    normalizedRelation: NormalizedRelation
}

export function compileRelationalStub(
    frame: ManipulationFrame,
    _intentConfidence: number
): ParseCommandErrorResult {
    const norm = normalizeRelationSpan(frame.relationSpan)
    if (norm.type === 'nestingDefer') {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        }
    }
    void norm.relation
    return {
        type: 'Error',
        errorMessage: objectManipulationErrorMessages.complexRelational,
    }
}
