import internalCache from '../internalCache'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { isStandardExampleData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/example'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { StandardMarkFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/mark'
import { SituationRoomFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { StandardEditableData, extractFromEditableData } from '@tonylb/mtw-base/ts/editable'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'

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

const getExamplesReferenceList = (component: StandardComponent): ReferenceList | undefined => {
    if (component instanceof StandardRoom) {
        return component.examples
    }
    if (component instanceof StandardFeature) {
        return component.examples
    }
    if (component instanceof StandardKnowledge) {
        return component.examples
    }
    return undefined
}

export const getParentIdsForExample = async (
    exampleId: ComponentUUID,
    assetStack: AssetUUID[],
    eventAssetId: AssetUUID
): Promise<ComponentUUID[]> => {
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
        .filter((component) => {
            const tag = (component as any).tag
            return tag === 'Room' || tag === 'Feature' || tag === 'Knowledge'
        })
        .filter((component) => {
            const examples = getExamplesReferenceList(component)
            if (!examples) {
                return false
            }
            return examples.payload.some((reference) => reference.universalKey === exampleId)
        })
        .map((component) => component.universalKey as ComponentUUID)

    return Array.from(new Set(parentIds))
}

export const mergeExampleAcrossStack = (
    byAssets: ComponentDataByAsset,
    assetStack: AssetUUID[]
): StandardExample | undefined => {
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
            if (!(component instanceof StandardExample)) return undefined
            const index = indexByAsset[AssetId]
            if (typeof index !== 'number') return undefined
            return { index, example: component } as { index: number; example: StandardExample }
        })
        .filter(excludeUndefined)
        .sort((a, b) => a.index - b.index)

    if (!withIndex.length) return undefined

    let merged: StandardExample = withIndex[0].example as StandardExample
    for (let i = 1; i < withIndex.length; i++) {
        merged = merged.merge(withIndex[i].example) as StandardExample
    }
    return merged
}

export const exampleToCacheShape = (example: StandardExample): ComponentExamplesPayload => {
    //
    // Extract markState from MarkFacetList
    //
    const markValue: ComponentExamplesMarkValue[] =
        example.marks.items.map((facet) => {
            const markFacet = facet as StandardMarkFacet
            const mark = String(markFacet.reference.universalKey ?? '')
            const payload = markFacet.payload as any

            let value = ''
            if (payload && typeof payload === 'object' && typeof payload.toJSON === 'function') {
                //
                // MarkFacetPayload extends StandardLiteral; toJSON returns
                // StandardEditableData<string>. Extract the first string value.
                //
                const editable = payload.toJSON() as StandardEditableData<string>
                const values = extractFromEditableData<string>(editable)
                value = values[0] ?? ''
            }
            else if (typeof payload === 'string') {
                value = payload
            }

            return { mark, value }
        })

    const markState: ComponentExamplesMarkState = {
        markValue,
    }

    //
    // Extract RenderTree content from StandardRender / StandardEditableData
    //
    const json = example.toJSON()
    if (!isStandardExampleData(json)) {
        throw new Error('Expected StandardExampleData from example.toJSON()')
    }

    const toRenderTree = (editable?: StandardEditableData<RenderTree>): RenderTree | undefined => {
        if (!editable) return undefined
        const trees = extractFromEditableData<RenderTree>(editable)
        return trees[0]
    }

    const displayName = toRenderTree(json.displayName)
    const summary = toRenderTree(json.summary)
    const description = toRenderTree(json.description) ?? []

    const renderedContent: ComponentExamplesRenderedContent = {
        ...(displayName ? { displayName } : {}),
        ...(summary ? { summary } : {}),
        description,
    }

    const provenance: ComponentExamplesProvenance = {
        type: 'authored',
    }

    return {
        markState,
        renderedContent,
        provenance,
    }
}

/**
 * Build ComponentExamplesPayload from a Situation and its Room facet payload.
 * Same shape as exampleToCacheShape so situation-facet events can reuse the stream.
 */
export const situationFacetToCacheShape = (
    situation: StandardSituation,
    facetPayload: SituationRoomFacetPayload
): ComponentExamplesPayload => {
    const markValue: ComponentExamplesMarkValue[] = situation.marks.items.map((facet) => {
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
        return { mark, value }
    })
    const markState: ComponentExamplesMarkState = { markValue }

    const toRenderTree = (editable?: StandardEditableData<RenderTree>): RenderTree | undefined => {
        if (!editable) return undefined
        const trees = extractFromEditableData<RenderTree>(editable)
        return trees[0]
    }
    const displayName = facetPayload._displayName
        ? toRenderTree(facetPayload._displayName.toJSON() as StandardEditableData<RenderTree>)
        : undefined
    const summary = facetPayload._summary
        ? toRenderTree(facetPayload._summary.toJSON() as StandardEditableData<RenderTree>)
        : undefined
    const description =
        facetPayload._description != null
            ? (toRenderTree(facetPayload._description.toJSON() as StandardEditableData<RenderTree>) ?? [])
            : []

    const renderedContent: ComponentExamplesRenderedContent = {
        ...(displayName ? { displayName } : {}),
        ...(summary ? { summary } : {}),
        description,
    }
    const provenance: ComponentExamplesProvenance = { type: 'authored' }
    return { markState, renderedContent, provenance }
}

export const enrichExampleEvent = async (params: {
    exampleId: ComponentUUID;
    eventAssetId: AssetUUID;
    component: StandardComponent;
    eventType: 'Component Updated' | 'Component Removed';
}): Promise<EnrichedExampleEvent> => {
    const { exampleId, eventAssetId, eventType } = params

    const [componentData] = await internalCache.ComponentData.get([exampleId as EphemeraId])
    const byAssets = componentData?.byAssets ?? []

    const assetStack = getOrderedAssetStack(exampleId, eventAssetId, byAssets)
    const parentIds = await getParentIdsForExample(exampleId, assetStack, eventAssetId)

    if (eventType === 'Component Removed') {
        return {
            exampleId,
            assetStack,
            parentIds,
        }
    }

    const mergedExample = mergeExampleAcrossStack(byAssets, assetStack)

    if (!mergedExample) {
        return {
            exampleId,
            assetStack,
            parentIds,
        }
    }

    const example = exampleToCacheShape(mergedExample)

    return {
        exampleId,
        assetStack,
        parentIds,
        example,
    }
}

