/**
 * Situation label helper: derive a compact display label for a Situation.
 * Situation has no shortName; we use a Marks-summary. A future shortName on the
 * Situation payload could provide an author-defined label with this as fallback.
 */

import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import type { StandardMarkFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/mark'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'

function markFacetKey(facet: StandardMarkFacet, standardForm: StandardForm | null | undefined): string {
    const universalKey = facet.reference?.universalKey
    if (!universalKey) return facet.reference?.standardKey?.key ?? 'mark'
    if (standardForm) {
        const component = standardForm.byUniversalId[universalKey as ComponentUUID]
        if (component && component instanceof StandardMark && component.shortName) {
            const plain = (component.shortName as { _payload?: { plain?: { toJSON?: () => unknown } } })._payload?.plain?.toJSON?.()
            if (typeof plain === 'string' && plain.trim()) return plain
        }
        if (component && (component as { key?: string }).key) return (component as { key: string }).key
    }
    return facet.reference?.standardKey?.key ?? String(universalKey)
}

function markFacetValue(facet: StandardMarkFacet): string {
    const payload = facet.payload as { toJSON?: () => unknown }
    if (payload && typeof payload.toJSON === 'function') {
        const v = payload.toJSON()
        return typeof v === 'string' ? v : ''
    }
    return ''
}

/**
 * Returns a human-readable label fragment for a Situation from its MarkFacetList.
 * Format: "markKey: matchValue, markKey: matchValue" (e.g. "illumination: bright, mood: somber").
 * Fallback: situation.key if set, else "Situation".
 * This function intentionally does not consider Situation.shortName; callers can
 * build composite labels like "Untitled (<aggregate>)" on top of this summary.
 */
export function situationToMarksSummary(
    situation: StandardSituation,
    standardForm?: StandardForm | null
): string {
    const items = situation.marks?.items ?? []
    if (items.length === 0) {
        const key = situation.key
        if (typeof key === 'string' && key.trim()) return key
        return 'Situation'
    }
    const parts = items.map((facet: StandardMarkFacet) => {
        const key = markFacetKey(facet, standardForm ?? null)
        const value = markFacetValue(facet)
        return `${key}: ${value}`
    })
    return parts.join(', ')
}

/**
 * Derives generateRoomPreview-style markState from a Situation's marks.
 * Used for "Preview by situation" in RoomPreviewEditor.
 */
export function situationMarksToMarkState(situation: StandardSituation): { markValue: { mark: string; value: string }[] } {
    const items = situation.marks?.items ?? []
    const markValue = items.map((facet: StandardMarkFacet) => {
        const mark = String(facet.reference?.universalKey ?? '')
        const payload = facet.payload as { toJSON?: () => unknown }
        let value = ''
        if (payload && typeof payload.toJSON === 'function') {
            const v = payload.toJSON()
            value = typeof v === 'string' ? v : ''
        }
        return { mark, value }
    })
    return { markValue }
}

/**
 * Returns a label for a Situation by id when you have StandardForm.
 * Uses situationToMarksSummary if the component is found; otherwise "Situation".
 */
export function situationIdToLabel(
    situationId: ComponentUUID,
    standardForm: StandardForm | null | undefined
): string {
    if (!standardForm) return 'Untitled (Situation)'
    const component = standardForm.byUniversalId[situationId]
    if (!component || !(component instanceof StandardSituation)) return 'Untitled (Situation)'

    //
    // Precedence:
    // 1. Situation shortName when present and non-empty.
    // 2. "Untitled (<aggregate>)" where <aggregate> is the marks-summary (or "Situation" fallback).
    //
    const shortNameLiteral = component.shortName
    const shortNamePlain = shortNameLiteral?._payload?.plain?.toJSON()
    if (typeof shortNamePlain === 'string' && shortNamePlain.trim()) {
        return shortNamePlain
    }

    const aggregate = situationToMarksSummary(component, standardForm)
    return `Untitled (${aggregate})`
}
