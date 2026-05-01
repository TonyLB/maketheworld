import {
    isNormalizedMaterializedAffordanceStableKey,
    isSyntaxMaterializedAffordanceStableKey,
    MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX,
    NORMALIZED_MATERIALIZED_AFFORDANCE_PREFIX,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    normalizedPhasePlanStableKey,
    type CoyotePhasePlan,
} from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
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
 * Deterministic outline of **phasePlan** for plan-outcome prompting: ordered phases,
 * achievements, prep vs beat, staged props, virtual entities.
 */
export function formatPhasePlanForOutcomePrompt(
    phasePlan: CoyotePhasePlan,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const keyToShort = buildStableKeyToShortNameMap(roomObjectsByRoom)
    const lines: string[] = [
        `Trope sequence: ${phasePlan.tropeSequence.join(' -> ')}`,
        `Deconfliction: ${phasePlan.deconflictionSummary}`,
        '',
    ]

    phasePlan.phases.forEach((phase, index) => {
        const n = index + 1
        const prep =
            phase.prepVsBeat !== undefined ? ` — ${phase.prepVsBeat}` : ''
        lines.push(`Phase ${n}${prep}: ${phase.trope} — ${phase.tropeBeat}`)
        lines.push(`  Achievement: ${phase.achievement}`)
        if (phase.stableKeysUsed.length > 0) {
            const labels = phase.stableKeysUsed.map((sk) => resolveStableKeyLabel(sk, keyToShort))
            lines.push(`  Staged props and materialized affordances: ${labels.join(', ')}`)
        }
        for (const ve of phase.virtualEntities) {
            const derived = ve.derivedFrom.join(', ')
            lines.push(`  Virtual "${ve.label}" (${ve.phaseKind}): from ${derived}`)
        }
    })

    return lines.join('\n')
}
