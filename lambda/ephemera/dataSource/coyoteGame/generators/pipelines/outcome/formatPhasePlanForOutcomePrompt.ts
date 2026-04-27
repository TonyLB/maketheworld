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

function resolveStableKeyLabel(rawKey: string, keyToShort: Map<string, string>): string {
    const norm = normalizedPhasePlanStableKey(rawKey)
    const shortName = keyToShort.get(norm)
    return shortName !== undefined ? `${shortName} (${rawKey})` : rawKey
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
    const lines: string[] = []

    phasePlan.phases.forEach((phase, index) => {
        const n = index + 1
        const prep =
            phase.prepVsBeat !== undefined ? ` — ${phase.prepVsBeat}` : ''
        lines.push(`Phase ${n}${prep}: ${phase.achievement}`)
        if (phase.stableKeysUsed.length > 0) {
            const labels = phase.stableKeysUsed.map((sk) => resolveStableKeyLabel(sk, keyToShort))
            lines.push(`  Staged props: ${labels.join(', ')}`)
        }
        for (const ve of phase.virtualEntities) {
            const derived = ve.derivedFrom.join(', ')
            lines.push(`  Virtual "${ve.label}" (${ve.phaseKind}): from ${derived}`)
        }
    })

    return lines.join('\n')
}
