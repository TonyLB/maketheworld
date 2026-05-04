import {
    isNormalizedMaterializedAffordanceStableKey,
    isSyntaxMaterializedAffordanceStableKey,
    MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX,
    NORMALIZED_MATERIALIZED_AFFORDANCE_PREFIX,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { normalizedPhasePlanStableKey } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import {
    type CoyoteNarrativeBeatsStructured,
} from '@tonylb/mtw-interfaces/ts/coyoteNarrativeBeatsStructured'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

/** Maps normalized snapshot stable keys to display **shortName** for prompt-facing text. */
export function buildStableKeyToShortNameMap(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): Map<string, string> {
    const map = new Map<string, string>()
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            map.set(normalizedPhasePlanStableKey(o.stableKey), o.shortName)
        }
    }
    return map
}

function materializedAffordanceLabel(rawKey: string): string {
    const t = rawKey.trim()
    if (isSyntaxMaterializedAffordanceStableKey(t)) {
        const suffix = t.slice(MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX.length)
        return `${suffix} (materialized affordance: ${t})`
    }
    const norm = normalizedPhasePlanStableKey(t)
    if (isNormalizedMaterializedAffordanceStableKey(norm)) {
        const rest = norm.slice(NORMALIZED_MATERIALIZED_AFFORDANCE_PREFIX.length)
        return `${rest} (materialized affordance: ${t})`
    }
    return t
}

function resolveStableKeyLabel(rawKey: string, keyToShort: Map<string, string>): string {
    const norm = normalizedPhasePlanStableKey(rawKey)
    const shortName = keyToShort.get(norm)
    if (shortName !== undefined) {
        return `${shortName} (${rawKey})`
    }
    if (isSyntaxMaterializedAffordanceStableKey(rawKey) || isNormalizedMaterializedAffordanceStableKey(norm)) {
        return materializedAffordanceLabel(rawKey)
    }
    return rawKey
}

/**
 * Deterministic outline of **narrativeBeatsStructured** for plan-outcome prompting.
 */
export function formatNarrativeBeatsStructuredForOutcomePrompt(
    narrativeBeatsStructured: CoyoteNarrativeBeatsStructured,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const keyToShort = buildStableKeyToShortNameMap(roomObjectsByRoom)
    const lines: string[] = [
        `Linearized sequence: ${narrativeBeatsStructured.linearizedSequence.join(' -> ')}`,
        '',
    ]

    narrativeBeatsStructured.beats.forEach((beat, index) => {
        const n = index + 1
        lines.push(`Beat ${n}: ${beat.beatId}`)
        lines.push(`  Description: ${beat.description}`)
        if (beat.derivedFrom.length > 0) {
            const labels = beat.derivedFrom.map((sk) => resolveStableKeyLabel(sk, keyToShort))
            lines.push(`  Grounded from: ${labels.join(', ')}`)
        }
    })

    return lines.join('\n')
}

export const formatPhasePlanForOutcomePrompt = formatNarrativeBeatsStructuredForOutcomePrompt
