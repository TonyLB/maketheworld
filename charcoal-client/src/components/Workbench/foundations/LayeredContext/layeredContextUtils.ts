/**
 * Layered context utils: detect when the breadcrumb stack represents a "layered tab"
 * context (e.g. Room → Example or Room → Guidance) and derive siblings for the tab strip.
 * No React/Redux; used by workbench selectors and WorkbenchContainer.
 */

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { excludeUndefined } from '../../../../lib/lists'
import { situationIdToLabel } from '../../../../lib/situationLabel'

export const COMPONENT_TAGS_WITH_LAYERED_TABS = ['EXAMPLE', 'GUIDANCE', 'SITUATION_FACET'] as const

export type LayeredChildTag = 'Example' | 'Guidance' | 'SituationFacet'

export type LayeredContextResult = {
    parentId: ComponentUUID
    currentId: ComponentUUID
    tag: LayeredChildTag
    siblings: { id: ComponentUUID; label: string | null }[]
}

/** Stack entry shape used by getLayeredContext; matches WorkbenchBreadcrumbEntry. */
export type BreadcrumbEntryLike = {
    id: string
    kind: 'component'
    componentId: string | null
}

function getReferenceList(
    parent: StandardRoom | StandardFeature | StandardKnowledge,
    childTag: LayeredChildTag
): StandardReference[] | null {
    if (childTag === 'Example') {
        if (parent instanceof StandardRoom) return null
        return parent.examples.payload.filter(
            (ref): ref is StandardReference => ref instanceof StandardReference
        )
    }
    if (childTag === 'Guidance') {
        if (!(parent instanceof StandardRoom)) return null
        return parent.guidance.payload.filter(
            (ref): ref is StandardReference => ref instanceof StandardReference
        )
    }
    return null
}

function isTagInLayeredTabs(tag: LayeredChildTag): boolean {
    if (tag === 'Example') return COMPONENT_TAGS_WITH_LAYERED_TABS.includes('EXAMPLE')
    if (tag === 'Guidance') return COMPONENT_TAGS_WITH_LAYERED_TABS.includes('GUIDANCE')
    if (tag === 'SituationFacet') return COMPONENT_TAGS_WITH_LAYERED_TABS.includes('SITUATION_FACET')
    return false
}

/**
 * Returns siblings { id, label }[] for a Room's situation facets (stack [RoomId, SituationId]).
 */
export function findSituationFacetSiblings(
    standardForm: StandardForm,
    room: StandardRoom
): { id: ComponentUUID; label: string | null }[] {
    const mapped = room.situations.items
        .map((facet) => {
            const situationId = facet.reference?.universalKey as ComponentUUID | undefined
            if (!situationId) return null
            const label = situationIdToLabel(situationId, standardForm)
            return { id: situationId, label }
        })
        .filter((x): x is { id: ComponentUUID; label: string } => x !== null)
    return mapped
}

/**
 * Returns true if parent is Room and childId is a situation id in that Room's situations facet list.
 */
export function isSituationFacetChild(
    standardForm: StandardForm,
    parentId: ComponentUUID | null,
    childId: ComponentUUID | null
): boolean {
    if (!parentId || !childId) return false
    const parent = standardForm.byUniversalId[parentId]
    if (!(parent instanceof StandardRoom)) return false
    return parent.situations.items.some(
        (facet) => facet.reference?.universalKey === childId
    )
}

/**
 * Returns siblings { id, label }[] for the given parent and child tag (Example or Guidance).
 * Room: examples + guidance; Feature/Knowledge: examples only.
 */
export function findReferenceSiblings(
    standardForm: StandardForm,
    parentComponent: StandardRoom | StandardFeature | StandardKnowledge,
    childTag: LayeredChildTag
): { id: ComponentUUID; label: string | null }[] {
    const refs = getReferenceList(parentComponent, childTag)
    if (!refs) return []

    return refs
        .map((ref) => ref.universalKey)
        .filter(excludeUndefined)
        .map((universalKey) => {
            const comp = standardForm.byUniversalId[universalKey as ComponentUUID]
            let label: string | null = null
            if (comp && (comp instanceof StandardExample || comp instanceof StandardGuidance)) {
                const labelLiteral = comp.shortName
                label = labelLiteral ? labelLiteral._payload?.plain?.toJSON() ?? null : null
            }
            return { id: universalKey as ComponentUUID, label }
        })
}

/**
 * Returns true if childId appears in parent's guidance payload (Room) or examples payload
 * (Feature/Knowledge) by universalKey.
 */
export function isReferenceListChild(
    standardForm: StandardForm,
    parentId: ComponentUUID | null,
    childId: ComponentUUID | null
): boolean {
    if (!parentId || !childId) return false
    const parent = standardForm.byUniversalId[parentId]
    if (!(parent instanceof StandardRoom) && !(parent instanceof StandardFeature) && !(parent instanceof StandardKnowledge)) {
        return false
    }
    const inExamples = (parent instanceof StandardFeature || parent instanceof StandardKnowledge) && parent.examples.payload.some(
        (ref) => ref instanceof StandardReference && ref.universalKey === childId
    )
    if (inExamples) return true
    if (parent instanceof StandardRoom) {
        return parent.guidance.payload.some(
            (ref) => ref instanceof StandardReference && ref.universalKey === childId
        )
    }
    return false
}

/**
 * If the stack represents a layered tab context (parent + child where child is in parent's
 * examples, guidance, or situation facets and tag is in COMPONENT_TAGS_WITH_LAYERED_TABS),
 * return context; else null.
 */
export function getLayeredContext(
    standardForm: StandardForm | null,
    stack: BreadcrumbEntryLike[]
): LayeredContextResult | null {
    if (!standardForm || stack.length < 2) return null

    const last = stack[stack.length - 1]
    const second = stack[stack.length - 2]
    const parentId = second.componentId as ComponentUUID | null
    const currentId = last.componentId as ComponentUUID | null
    if (!parentId || !currentId) return null

    const parent = standardForm.byUniversalId[parentId]
    if (!parent) return null

    if (parent instanceof StandardRoom && isSituationFacetChild(standardForm, parentId, currentId)) {
        const tag: LayeredChildTag = 'SituationFacet'
        if (!isTagInLayeredTabs(tag)) return null
        const siblings = findSituationFacetSiblings(standardForm, parent)
        return { parentId, currentId, tag, siblings }
    }

    const child = standardForm.byUniversalId[currentId]
    if (!child) return null

    if (!(parent instanceof StandardRoom) && !(parent instanceof StandardFeature) && !(parent instanceof StandardKnowledge)) {
        return null
    }
    if (child instanceof StandardMark) return null

    const inExamples = (parent instanceof StandardFeature || parent instanceof StandardKnowledge) && parent.examples.payload.some(
        (ref) => ref instanceof StandardReference && ref.universalKey === currentId
    )
    const inGuidance = parent instanceof StandardRoom && parent.guidance.payload.some(
        (ref) => ref instanceof StandardReference && ref.universalKey === currentId
    )
    const tag: LayeredChildTag | null = inExamples ? 'Example' : inGuidance ? 'Guidance' : null
    if (!tag || !isTagInLayeredTabs(tag)) return null

    const siblings = findReferenceSiblings(standardForm, parent, tag)
    return { parentId, currentId, tag, siblings }
}
