import { normalizeExitName } from '../../roomExitTargetsForCharacter'

import type { ManipulationFrameBuildInput } from './manipulationFrame'

const RELATIONAL_PREPOSITION_PATTERN = /\b(?:on|under|against|around|onto|over|beneath|beside)\b/

export type RelationalRouteOutcome =
    | { type: 'relational' }
    | { type: 'membership' }

export function commandHasRelationalPreposition(command: string): boolean {
    const normalized = normalizeExitName(command)
    if (!normalized) {
        return false
    }
    return RELATIONAL_PREPOSITION_PATTERN.test(normalized)
}

export function evaluateRelationalRoute(input: ManipulationFrameBuildInput): RelationalRouteOutcome {
    if (commandHasRelationalPreposition(input.command)) {
        return { type: 'relational' }
    }
    return { type: 'membership' }
}
