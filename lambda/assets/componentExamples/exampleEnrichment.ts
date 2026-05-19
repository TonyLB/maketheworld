import internalCache from '../internalCache'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardMarkFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/mark'
import {
    SituationProseFacetPayload,
    StandardSituationProseFacet,
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { StandardEditableData, extractFromEditableData } from '@tonylb/mtw-base/ts/editable'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import { getLensMarksWithDefaults, LensMarkWithDefault } from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'
import type { PerspectiveMatcher } from '@tonylb/mtw-interfaces/ts/perspective'

//
// Minimal cache-shaped payload used for Example mirroring events.
// This intentionally mirrors the Ephemera cache types but lives
// in the Assets Lambda so that mtw.assets.componentExamples can
// publish enriched Example payloads without depending on Ephemera.
//

export type ComponentExamplesMarkValue = {
    mark: string;
    value: string;
}

export type ComponentExamplesMarkState = {
    markValue: ComponentExamplesMarkValue[];
}

export type ComponentExamplesRenderedContent = {
    displayName?: RenderTree;
    summary?: RenderTree;
    description: RenderTree;
}

export type ComponentExamplesProvenance = {
    type: 'authored';
}

export type ComponentExamplesPayload = {
    markState: ComponentExamplesMarkState;
    renderedContent: ComponentExamplesRenderedContent;
    provenance: ComponentExamplesProvenance;
}

export type EnrichedExampleEvent = {
    exampleId: ComponentUUID;
    assetStack: AssetUUID[];
    parentIds: ComponentUUID[];
    example?: ComponentExamplesPayload;
}

type ComponentDataByAsset = {
    AssetId: AssetUUID;
    component: StandardComponent;
}[];

export const getOrderedAssetStack = (
    exampleId: ComponentUUID,
    eventAssetId: AssetUUID,
    byAssets: ComponentDataByAsset
): AssetUUID[] => {
    const assetIds = Array.from(
        new Set<AssetUUID>([
            ...byAssets.map(({ AssetId }) => AssetId),
            eventAssetId,
        ])
    )

    if (assetIds.length === 0) {
        return [eventAssetId]
    }

    //
    // Build a mapping from assetId to its parent asset (via component._from)
    //
    const parentByAsset = byAssets.reduce<Partial<Record<AssetUUID, AssetUUID>>>(
        (previous, { AssetId, component }) => {
            const from = (component as any)._from as AssetUUID | undefined
            if (from && assetIds.includes(from)) {
                return {
                    ...previous,
                    [AssetId]: from,
                }
            }
            return previous
        },
        {}
    )

    //
    // Compute a depth value for each asset based on following _from links.
    // Assets with no parent in this set get depth 0. This gives a simple
    // base-first ordering even when the chain is not strictly linear.
    //
    const depthMemo = new Map<AssetUUID, number>()
    const computeDepth = (assetId: AssetUUID, seen: Set<AssetUUID> = new Set()): number => {
        if (depthMemo.has(assetId)) {
            return depthMemo.get(assetId) as number
        }
        if (seen.has(assetId)) {
            // Cycle detected; treat as root
            depthMemo.set(assetId, 0)
            return 0
        }
        seen.add(assetId)
        const parent = parentByAsset[assetId]
        if (!parent || !assetIds.includes(parent)) {
            depthMemo.set(assetId, 0)
            return 0
        }
        const depth = computeDepth(parent, seen) + 1
        depthMemo.set(assetId, depth)
        return depth
    }

    const assetsWithDepth = assetIds.map((assetId) => ({
        assetId,
        depth: computeDepth(assetId),
    }))

    assetsWithDepth.sort((a, b) => {
        if (a.depth !== b.depth) {
            return a.depth - b.depth
        }
        //
        // When depths are equal, prefer deterministic ordering and keep
        // the event asset toward the end so that its version of the
        // Example wins ties in merge order.
        //
        if (a.assetId === eventAssetId) {
            return 1
        }
        if (b.assetId === eventAssetId) {
            return -1
        }
        return a.assetId.localeCompare(b.assetId)
    })

    return assetsWithDepth.map(({ assetId }) => assetId)
}

export type ParentWithSituationFacets = StandardRoom | StandardFeature | StandardKnowledge

export const parentHasFacetForSituation = (
    parent: ParentWithSituationFacets | undefined,
    situationId: ComponentUUID
): boolean =>
    (parent?.situations?.items?.some(
        (f) => (f as StandardSituationProseFacet).reference?.universalKey === situationId
    )) === true

/**
 * Room / Feature / Knowledge parents whose `situations` facet references `situationId`.
 */
export const getParentIdsForSituation = async (
    situationId: ComponentUUID,
    assetStack: AssetUUID[],
    eventAssetId: AssetUUID
): Promise<ComponentUUID[]> => {
    if (!isEphemeraSituationId(situationId)) {
        return []
    }

    const assetIds = Array.from(
        new Set<AssetUUID>([
            ...assetStack,
            eventAssetId,
        ])
    )

    if (!assetIds.length) {
        return []
    }

    const assetData = await internalCache.AssetData.get(assetIds)

    const parentIds = assetData
        .flatMap(({ standardForm }) => standardForm._components)
        .filter((component): component is ParentWithSituationFacets =>
            component instanceof StandardRoom ||
            component instanceof StandardFeature ||
            component instanceof StandardKnowledge
        )
        .filter((component) => parentHasFacetForSituation(component, situationId))
        .map((component) => component.universalKey as ComponentUUID)

    return Array.from(new Set(parentIds))
}

export const mergeSituationAcrossStack = (
    byAssets: ComponentDataByAsset,
    assetStack: AssetUUID[]
): StandardSituation | undefined => {
    if (!byAssets.length || !assetStack.length) {
        return undefined
    }

    const indexByAsset = assetStack.reduce<Record<AssetUUID, number>>(
        (previous, assetId, index) => ({
            ...previous,
            [assetId]: index,
        }),
        {}
    )

    const withIndex = byAssets
        .map(({ AssetId, component }) => {
            if (!(component instanceof StandardSituation)) return undefined
            const index = indexByAsset[AssetId]
            if (typeof index !== 'number') return undefined
            return { index, situation: component } as { index: number; situation: StandardSituation }
        })
        .filter(excludeUndefined)
        .sort((a, b) => a.index - b.index)

    if (!withIndex.length) return undefined

    let merged: StandardSituation = withIndex[0].situation as StandardSituation
    for (let i = 1; i < withIndex.length; i++) {
        merged = merged.merge(withIndex[i].situation) as StandardSituation
    }
    return merged
}

export const mergeRoomAcrossStack = (
    byAssets: ComponentDataByAsset,
    assetStack: AssetUUID[]
): StandardRoom | undefined => {
    if (!byAssets.length || !assetStack.length) {
        return undefined
    }

    const indexByAsset = assetStack.reduce<Record<AssetUUID, number>>(
        (previous, assetId, index) => ({
            ...previous,
            [assetId]: index,
        }),
        {}
    )

    const withIndex = byAssets
        .map(({ AssetId, component }) => {
            if (!(component instanceof StandardRoom)) return undefined
            const index = indexByAsset[AssetId]
            if (typeof index !== 'number') return undefined
            return { index, room: component } as { index: number; room: StandardRoom }
        })
        .filter(excludeUndefined)
        .sort((a, b) => a.index - b.index)

    if (!withIndex.length) return undefined

    let merged: StandardRoom = withIndex[0].room as StandardRoom
    for (let i = 1; i < withIndex.length; i++) {
        merged = merged.merge(withIndex[i].room) as StandardRoom
    }
    return merged
}

export const mergeLensAcrossStack = (
    byAssets: ComponentDataByAsset,
    assetStack: AssetUUID[]
): StandardLens | undefined => {
    if (!byAssets.length || !assetStack.length) {
        return undefined
    }

    const indexByAsset = assetStack.reduce<Record<AssetUUID, number>>(
        (previous, assetId, index) => ({
            ...previous,
            [assetId]: index,
        }),
        {}
    )

    const withIndex = byAssets
        .map(({ AssetId, component }) => {
            if (!(component instanceof StandardLens)) return undefined
            const index = indexByAsset[AssetId]
            if (typeof index !== 'number') return undefined
            return { index, lens: component } as { index: number; lens: StandardLens }
        })
        .filter(excludeUndefined)
        .sort((a, b) => a.index - b.index)

    if (!withIndex.length) return undefined

    let merged: StandardLens = withIndex[0].lens as StandardLens
    for (let i = 1; i < withIndex.length; i++) {
        merged = merged.merge(withIndex[i].lens) as StandardLens
    }
    return merged
}

export type SituationFacetToCacheShapeOptions = {
    lensMarks?: LensMarkWithDefault[];
}

/**
 * Build ComponentExamplesPayload from a Situation and its facet payload for render-cache mirroring.
 *
 * When options.lensMarks is provided, limit marks to those defined on the lens and
 * use lens defaults for any mark not explicitly set on the situation.
 */
export const situationFacetToCacheShape = (
    situation: StandardSituation,
    facetPayload: SituationProseFacetPayload,
    options?: SituationFacetToCacheShapeOptions
): ComponentExamplesPayload => {
    const situationMarkValues = new Map<string, string>()
    situation.marks.items.forEach((facet) => {
        const markFacet = facet as StandardMarkFacet
        const mark = String(markFacet.reference.universalKey ?? '')
        const payload = markFacet.payload as any
        let value = ''
        if (payload && typeof payload === 'object' && typeof payload.toJSON === 'function') {
            const editable = payload.toJSON() as StandardEditableData<string>
            const values = extractFromEditableData<string>(editable)
            value = values[0] ?? ''
        } else if (typeof payload === 'string') {
            value = payload
        }
        situationMarkValues.set(mark, value)
    })

    let markValue: ComponentExamplesMarkValue[]
    if (options && options.lensMarks) {
        markValue = options.lensMarks.map(({ markId, default: defaultValue }) => {
            const value = situationMarkValues.get(markId) ?? defaultValue ?? ''
            return { mark: markId, value }
        })
    } else {
        markValue = Array.from(situationMarkValues.entries()).map(([mark, value]) => ({
            mark,
            value,
        }))
    }
    const markState: ComponentExamplesMarkState = { markValue }

    const toRenderTree = (editable?: StandardEditableData<RenderTree>): RenderTree | undefined => {
        if (!editable) return undefined
        const trees = extractFromEditableData<RenderTree>(editable)
        return trees[0]
    }
    // DisplayName is now a StandardLiteral (string-based); convert to RenderTree-compatible array of strings.
    const displayName = facetPayload._displayName
        ? (extractFromEditableData<string>(facetPayload._displayName.toJSON() as StandardEditableData<string>) as RenderTree)
        : undefined
    const summary = facetPayload._summary
        ? toRenderTree(facetPayload._summary.toJSON() as StandardEditableData<RenderTree>)
        : undefined
    const description =
        facetPayload._description != null
            ? (toRenderTree(facetPayload._description.toJSON() as StandardEditableData<RenderTree>) ?? [])
            : []

    const renderedContent: ComponentExamplesRenderedContent = {
        ...(displayName && (displayName as RenderTree).length ? { displayName } : {}),
        ...(summary ? { summary } : {}),
        description,
    }
    const provenance: ComponentExamplesProvenance = { type: 'authored' }
    return { markState, renderedContent, provenance }
}

//
// Perspective matcher for parent + Situation (Room, Feature, Knowledge).
// Structural test: parent has facet for this situationId; Situation has marks.
//

export const situationHasMarks = (situation: StandardSituation | undefined): boolean =>
    (situation?.marks?.length ?? 0) > 0

export type ComputePerspectiveMatcherForParentSituationParams = {
    parentId: ComponentUUID;
    situationId: ComponentUUID;
    assetStack: AssetUUID[];
    parentByAssets: ComponentDataByAsset;
    situationByAssets: ComponentDataByAsset;
}

export const computePerspectiveMatcherForParentSituation = ({
    parentId: _parentId,
    situationId,
    assetStack,
    parentByAssets,
    situationByAssets,
}: ComputePerspectiveMatcherForParentSituationParams): PerspectiveMatcher => {
    const stackSet = new Set(assetStack)
    const requiredAssetIds: AssetUUID[] = assetStack.filter((assetId) => {
        const parentEntry = parentByAssets.find((a) => a.AssetId === assetId)
        const situationEntry = situationByAssets.find((a) => a.AssetId === assetId)
        const parent = parentEntry?.component as ParentWithSituationFacets | undefined
        const situation = situationEntry?.component as StandardSituation | undefined
        return parentHasFacetForSituation(parent, situationId) || situationHasMarks(situation)
    })
    const allAssetIds = new Set<AssetUUID>(
        parentByAssets.map((a) => a.AssetId).concat(situationByAssets.map((a) => a.AssetId))
    )
    const candidates = [...allAssetIds].filter((id) => !stackSet.has(id))
    const forbiddenAssetIds: AssetUUID[] = candidates.filter((assetId) => {
        const parentEntry = parentByAssets.find((a) => a.AssetId === assetId)
        const situationEntry = situationByAssets.find((a) => a.AssetId === assetId)
        const parent = parentEntry?.component as ParentWithSituationFacets | undefined
        const situation = situationEntry?.component as StandardSituation | undefined
        return parentHasFacetForSituation(parent, situationId) || situationHasMarks(situation)
    })
    return { requiredAssetIds, forbiddenAssetIds }
}

export type ComputePerspectiveMatcherForRoomSituationParams = {
    roomId: ComponentUUID;
    situationId: ComponentUUID;
    assetStack: AssetUUID[];
    roomByAssets: ComponentDataByAsset;
    situationByAssets: ComponentDataByAsset;
}

export const computePerspectiveMatcherForRoomSituation = (
    params: ComputePerspectiveMatcherForRoomSituationParams
): PerspectiveMatcher =>
    computePerspectiveMatcherForParentSituation({
        parentId: params.roomId,
        situationId: params.situationId,
        assetStack: params.assetStack,
        parentByAssets: params.roomByAssets,
        situationByAssets: params.situationByAssets,
    })

