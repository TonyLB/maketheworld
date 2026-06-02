import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { ShortNamePayloadHost } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import {
    SituationProseFacetList,
    SituationProseFacetPayload,
    StandardSituationProseFacet
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

export type SituationProseParent = StandardRoom | StandardFeature | StandardKnowledge

export function isSituationProseParent(component: unknown): component is SituationProseParent {
    return (
        component instanceof StandardRoom ||
        component instanceof StandardFeature ||
        component instanceof StandardKnowledge
    )
}

type SituationProseParentPayloadHost = {
    _situations: SituationProseFacetList
}

export const findSituationFacet = (
    parent: SituationProseParent,
    situationId: ComponentUUID
): StandardSituationProseFacet | undefined =>
    parent.situations.items.find((f) => f.reference?.universalKey === situationId)

export const updateSituationFacetPayloadOnParent = (
    parent: SituationProseParent,
    situationId: ComponentUUID,
    updatePayload: (prev: SituationProseFacetPayload) => SituationProseFacetPayload,
    options?: { removeWhenEmpty?: boolean }
): void => {
    const facet = findSituationFacet(parent, situationId)
    if (!facet) {
        return
    }
    const newPayload = updatePayload(facet.payload as SituationProseFacetPayload)
    const payloadHost = parent._payload as unknown as SituationProseParentPayloadHost
    if (options?.removeWhenEmpty && SituationProseFacetPayload.isEmpty(newPayload)) {
        const newItems = parent.situations.items.filter(
            (f) => f.reference?.universalKey !== situationId
        )
        payloadHost._situations = new SituationProseFacetList(newItems)
        return
    }
    const newItems = parent.situations.items.map((f) => {
        if (f.reference?.universalKey !== situationId) {
            return f
        }
        return new StandardSituationProseFacet({
            reference:
                f.reference ??
                new StandardReference({ universalKey: situationId, tag: 'Situation' }),
            payload: newPayload.toJSON()
        })
    })
    payloadHost._situations = new SituationProseFacetList(newItems)
}

export const ensureSituationFacetWithPayloadOnParent = (
    parent: SituationProseParent,
    situationId: ComponentUUID,
    payload: SituationProseFacetPayload
): void => {
    const payloadHost = parent._payload as unknown as SituationProseParentPayloadHost
    const existingIndex = parent.situations.items.findIndex(
        (f) => f.reference?.universalKey === situationId
    )
    const existingFacet = existingIndex >= 0 ? parent.situations.items[existingIndex] : undefined
    const existingJson =
        existingFacet?.payload instanceof SituationProseFacetPayload
            ? existingFacet.payload.toJSON()
            : (existingFacet?.payload as Record<string, unknown> | undefined)
    const mergedPayload = existingJson
        ? new SituationProseFacetPayload({
              displayName: payload._displayName?.toJSON() ?? existingJson.displayName,
              summary: payload._summary?.toJSON() ?? existingJson.summary,
              description: payload._description?.toJSON() ?? existingJson.description
          })
        : payload
    const newFacet = new StandardSituationProseFacet({
        reference: new StandardReference({
            universalKey: situationId,
            tag: 'Situation'
        }),
        payload: mergedPayload.toJSON()
    })
    if (existingIndex >= 0) {
        const newItems = parent.situations.items.slice()
        newItems[existingIndex] = newFacet
        payloadHost._situations = new SituationProseFacetList(newItems)
    } else {
        payloadHost._situations = new SituationProseFacetList([
            ...parent.situations.items,
            newFacet
        ])
    }
}

export type ReconcileCommittedComponentParams<T extends StandardComponent> = {
    lastReceived: T | undefined
    working: T | undefined
    incoming: T | undefined
}

export type ReconcileCommittedComponentResult<T extends StandardComponent> = {
    working: T | undefined
    lastReceived: T | undefined
    superseded: boolean
}

const cloneComponent = <T extends StandardComponent>(component: T): T =>
    component.clone() as T

type ComponentWithShortNamePayload = StandardComponent & {
    _payload: ShortNamePayloadHost
}

/** Stable plain string for UI/tests. */
export const literalPlainString = (literal?: StandardLiteral): string => {
    const json = literal?.toJSON()
    return typeof json === 'string' ? json : ''
}

/**
 * D11 omission-over-empty: empty / whitespace-only -> undefined; else trimmed literal.
 */
export const normalizeOptionalLiteral = (
    literal?: StandardLiteral
): StandardLiteral | undefined => {
    if (!literal) {
        return undefined
    }
    const plain = literalPlainString(literal)
    if (!plain.trim()) {
        return undefined
    }
    return new StandardLiteral(plain.trim())
}

/** Apply D11 shortName normalization on a component payload (mutates in place). */
export const applyShortNameOnComponent = <T extends StandardComponent>(component: T): void => {
    const payload = (component as unknown as ComponentWithShortNamePayload)._payload
    if (!payload) {
        return
    }
    payload._shortName = normalizeOptionalLiteral(component.shortName)
}

/** Clone working copy and normalize shortName before flush (D11). */
export const prepareComponentForFlush = <T extends StandardComponent>(component: T): T => {
    const flushed = component.clone() as T
    applyShortNameOnComponent(flushed)
    return flushed
}

/**
 * Flush assign only (not the edit path): prepare `working` for persist (D11) and assign to
 * `draft.byUniversalId[componentId]`. Returns the flushed clone written to the draft.
 */
export const applyWorkingComponentToDraft = <T extends StandardComponent>(
    draft: StandardForm,
    componentId: ComponentUUID,
    working: T
): T => {
    const flushed = prepareComponentForFlush(working)
    draft.byUniversalId[componentId] = flushed
    return flushed
}

/** Set shortName on working copy from a string (no trim; flush normalizes per D11). */
export const setWorkingShortNameFromString = <T extends StandardComponent = StandardComponent>(
    component: T,
    value: string
): void => {
    const payload = (component as unknown as ComponentWithShortNamePayload)._payload
    payload._shortName = value ? new StandardLiteral(value) : undefined
}

/**
 * Three-way reconcile when Redux `committed` changes without this session's flush (D14).
 * Pure helper for unit tests and `useWorkbenchComponent`.
 */
export const reconcileCommittedComponent = <T extends StandardComponent>({
    lastReceived,
    working,
    incoming
}: ReconcileCommittedComponentParams<T>): ReconcileCommittedComponentResult<T> => {
    if (incoming === undefined) {
        return { working: undefined, lastReceived: undefined, superseded: false }
    }

    const incomingBaseline = cloneComponent(incoming)

    if (lastReceived === undefined || working === undefined) {
        return {
            working: cloneComponent(incoming),
            lastReceived: incomingBaseline,
            superseded: false
        }
    }

    const editDiff = lastReceived.diff(working)
    if (editDiff === undefined) {
        if (!lastReceived.equals(working)) {
            return {
                working: cloneComponent(incoming),
                lastReceived: incomingBaseline,
                superseded: true
            }
        }
        return {
            working: cloneComponent(incoming),
            lastReceived: incomingBaseline,
            superseded: false
        }
    }

    try {
        const merged = incoming.merge(editDiff)
        if (merged === undefined) {
            return {
                working: cloneComponent(incoming),
                lastReceived: incomingBaseline,
                superseded: false
            }
        }
        return {
            working: cloneComponent(merged as T),
            lastReceived: incomingBaseline,
            superseded: false
        }
    } catch {
        return {
            working: cloneComponent(incoming),
            lastReceived: incomingBaseline,
            superseded: true
        }
    }
}
