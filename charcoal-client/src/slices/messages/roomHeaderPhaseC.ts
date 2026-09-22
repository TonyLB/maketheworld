import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { componentDisplayLabel } from '../../lib/componentDisplayLabel'

/** Merge full room-shaped forms: render base, affordances incoming. Falls back to render-only if merge throws. */
export function mergePerceivedRoomForms(
    render?: StandardForm,
    affordance?: StandardForm
): StandardForm | undefined {
    if (render && affordance) {
        try {
            return render.merge(affordance)
        } catch {
            return render
        }
    }
    return render ?? affordance
}

/** Oxford-style English list for room object shortNames; null when there are no objects to show. */
export function formatRoomContentsLine(parsedWML: StandardForm | undefined, componentUUID: string): string | null {
    if (!parsedWML) {
        return null
    }
    const component = parsedWML.byUniversalId[componentUUID as ComponentUUID]
    if (!(component instanceof StandardRoom)) {
        return null
    }
    const objectRefs = component.ludicGraph.nodesByTag('Object')
    if (!objectRefs.payload.length) {
        return null
    }
    const names = objectRefs.payload
        .map((ref) => (ref.universalKey ? parsedWML.byUniversalId[ref.universalKey] : undefined))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => componentDisplayLabel(c))
        .filter((name): name is string => Boolean(name))
    if (names.length === 0) {
        return null
    }
    if (names.length === 1) {
        return `Contents: ${names[0]}`
    }
    if (names.length === 2) {
        return `Contents: ${names[0]} and ${names[1]}`
    }
    const last = names[names.length - 1]
    const rest = names.slice(0, -1).join(', ')
    return `Contents: ${rest}, and ${last}`
}
