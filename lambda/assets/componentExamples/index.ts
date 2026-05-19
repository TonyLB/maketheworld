//
// Non-replayable DataSource for mtw.assets.componentExamples
//
// Subscribes to mtw.assets Component Updated / Component Removed and publishes
// Example-lifecycle events (legacy wire names) for:
// - Room / Feature / Knowledge parent updates (situation facets on parent)
// - Situation component updates (fan-out to facet parents via getParentIdsForSituation)
//
import { AssetsDataSource } from '../dataSource/abstract'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import {
    ComponentExamplesSubscribedContent,
    isComponentExamplesSubscribedEnvelope,
} from './subscribedEvents'
import {
    computePerspectiveMatcherForParentSituation,
    getOrderedAssetStack,
    getParentIdsForSituation,
    mergeLensAcrossStack,
    mergeRoomAcrossStack,
    mergeSituationAcrossStack,
    ParentWithSituationFacets,
    situationFacetToCacheShape,
} from './exampleEnrichment'
import { getLensMarksWithDefaults } from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardSituationProseFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import {
    ComponentExamplesEventUpdate,
    ExampleRemoved,
    ExampleUpdated,
} from './events'

type StreamEventFn = (params: {
    update: ComponentExamplesEventUpdate;
    streamKey: string;
    header: { type: 'ExampleRemoved' | 'ExampleUpdated' };
}) => Promise<void>

type ComponentDataByAsset = {
    AssetId: AssetUUID;
    component: import('@tonylb/mtw-wml/ts/standardize/components/baseClasses').StandardComponent;
}[]

const resolveLensMarksWithDefaultsForRoom = async (
    parentForPayload: StandardRoom,
    byAssets: ComponentDataByAsset,
    assetStack: AssetUUID[]
): Promise<ReturnType<typeof getLensMarksWithDefaults> | undefined> => {
    const mergedRoom = mergeRoomAcrossStack(byAssets, assetStack) ?? parentForPayload
    const lensRef = mergedRoom.lens?.payload?.[0]
    const lensId = lensRef?.universalKey as ComponentUUID | undefined

    if (!lensId) {
        return undefined
    }

    const [lensData] = await internalCache.ComponentData.get([lensId as EphemeraId])
    const lensByAssets = lensData?.byAssets ?? []
    if (!lensByAssets.length) {
        return undefined
    }

    const eventLensAssetId = lensByAssets[lensByAssets.length - 1]?.AssetId as AssetUUID
    const lensAssetStack = getOrderedAssetStack(lensId, eventLensAssetId, lensByAssets)
    const mergedLens = mergeLensAcrossStack(lensByAssets, lensAssetStack)
    if (!mergedLens) {
        return undefined
    }

    return getLensMarksWithDefaults(mergedLens)
}

const emitSituationFacetRemovedForParent = async (params: {
    parentId: ComponentUUID;
    situationId: ComponentUUID;
    assetStack: AssetUUID[];
    parentByAssets: ComponentDataByAsset;
    situationByAssets: ComponentDataByAsset;
    streamEvent: StreamEventFn;
}): Promise<void> => {
    const { parentId, situationId, assetStack, parentByAssets, situationByAssets, streamEvent } = params
    const perspectiveMatcher = computePerspectiveMatcherForParentSituation({
        parentId,
        situationId,
        assetStack,
        parentByAssets,
        situationByAssets,
    })
    await streamEvent({
        update: {
            type: 'ExampleRemoved',
            exampleId: situationId,
            parentIds: [parentId],
            assetStack,
            perspectiveMatcher,
        },
        streamKey: situationId,
        header: { type: 'ExampleRemoved' },
    })
}

const emitSituationFacetUpdatedForParent = async (params: {
    parentId: ComponentUUID;
    situationId: ComponentUUID;
    assetStack: AssetUUID[];
    parentByAssets: ComponentDataByAsset;
    situationByAssets: ComponentDataByAsset;
    situationComponent: StandardSituation;
    facet: StandardSituationProseFacet;
    lensMarksWithDefaults?: ReturnType<typeof getLensMarksWithDefaults>;
    streamEvent: StreamEventFn;
}): Promise<void> => {
    const {
        parentId,
        situationId,
        assetStack,
        parentByAssets,
        situationByAssets,
        situationComponent,
        facet,
        lensMarksWithDefaults,
        streamEvent,
    } = params
    const perspectiveMatcher = computePerspectiveMatcherForParentSituation({
        parentId,
        situationId,
        assetStack,
        parentByAssets,
        situationByAssets,
    })
    const examplePayload = situationFacetToCacheShape(
        situationComponent,
        facet.payload,
        lensMarksWithDefaults ? { lensMarks: lensMarksWithDefaults } : undefined
    )
    await streamEvent({
        update: {
            type: 'ExampleUpdated',
            exampleId: situationId,
            parentIds: [parentId],
            assetStack,
            perspectiveMatcher,
            example: examplePayload,
        },
        streamKey: situationId,
        header: { type: 'ExampleUpdated' },
    })
}

const findFacetForSituation = (
    parent: ParentWithSituationFacets,
    situationId: ComponentUUID
): StandardSituationProseFacet | undefined =>
    parent.situations?.items?.find(
        (f) => (f as StandardSituationProseFacet).reference.universalKey === situationId
    ) as StandardSituationProseFacet | undefined

const emitParentSituationFacetEvents = async (params: {
    parent: ParentWithSituationFacets;
    parentId: ComponentUUID;
    assetId: AssetUUID;
    eventType: string;
    streamEvent: StreamEventFn;
    includeLensMarks: boolean;
}): Promise<void> => {
    const { parent, parentId, assetId, eventType, streamEvent, includeLensMarks } = params

    const [parentData] = await internalCache.ComponentData.get([parentId as EphemeraId])
    const byAssets = parentData?.byAssets ?? []
    const contentParent = byAssets.find((a) => a.AssetId === assetId)?.component as ParentWithSituationFacets | undefined
    const parentForPayload = contentParent ?? parent
    const assetStack = getOrderedAssetStack(parentId, assetId, byAssets)

    const lensMarksWithDefaults =
        includeLensMarks && parent instanceof StandardRoom
            ? await resolveLensMarksWithDefaultsForRoom(
                  parentForPayload as StandardRoom,
                  byAssets,
                  assetStack
              )
            : undefined

    const situationsListForPayload = parentForPayload.situations?.items ?? []
    if (situationsListForPayload.length === 0) {
        return
    }
    const situationIds = situationsListForPayload.map(
        (f) => (f as StandardSituationProseFacet).reference.universalKey
    )
    const situationCaches = await internalCache.ComponentData.get(situationIds as EphemeraId[])

    if (eventType === 'Component Removed') {
        for (let idx = 0; idx < situationIds.length; idx++) {
            const situationId = situationIds[idx]
            if (!situationId) continue
            const situationCache = situationCaches[idx]
            await emitSituationFacetRemovedForParent({
                parentId,
                situationId: situationId as ComponentUUID,
                assetStack,
                parentByAssets: byAssets,
                situationByAssets: situationCache?.byAssets ?? [],
                streamEvent,
            })
        }
        return
    }

    for (let i = 0; i < situationsListForPayload.length; i++) {
        const facet = situationsListForPayload[i] as StandardSituationProseFacet
        const situationId = facet.reference.universalKey as ComponentUUID
        const cache = situationCaches[i]
        const situationComponent = cache?.byAssets?.find(
            (a) => a.component instanceof StandardSituation
        )?.component as StandardSituation | undefined
        if (!situationComponent) {
            continue
        }
        await emitSituationFacetUpdatedForParent({
            parentId,
            situationId,
            assetStack,
            parentByAssets: byAssets,
            situationByAssets: cache?.byAssets ?? [],
            situationComponent,
            facet,
            lensMarksWithDefaults,
            streamEvent,
        })
    }
}

const emitSituationComponentFacetEvents = async (params: {
    situation: StandardSituation;
    situationId: ComponentUUID;
    assetId: AssetUUID;
    eventType: string;
    streamEvent: StreamEventFn;
}): Promise<void> => {
    const { situation, situationId, assetId, eventType, streamEvent } = params

    const [situationData] = await internalCache.ComponentData.get([situationId as EphemeraId])
    const situationByAssets = situationData?.byAssets ?? []
    const contentSituation = situationByAssets.find((a) => a.AssetId === assetId)?.component as
        | StandardSituation
        | undefined
    const situationForPayload = contentSituation ?? situation
    const assetStack = getOrderedAssetStack(situationId, assetId, situationByAssets)
    const mergedSituation =
        mergeSituationAcrossStack(situationByAssets, assetStack) ?? situationForPayload

    const parentIds = await getParentIdsForSituation(situationId, assetStack, assetId)
    if (parentIds.length === 0) {
        return
    }

    const parentCaches = await internalCache.ComponentData.get(parentIds as EphemeraId[])

    for (let i = 0; i < parentIds.length; i++) {
        const parentId = parentIds[i]
        const parentCache = parentCaches[i]
        const parentByAssets = parentCache?.byAssets ?? []
        const parentComponent = parentByAssets.find((a) => a.AssetId === assetId)?.component as
            | ParentWithSituationFacets
            | undefined
        const parentFromStack = parentByAssets
            .map((a) => a.component)
            .find(
                (c): c is ParentWithSituationFacets =>
                    c instanceof StandardRoom ||
                    c instanceof StandardFeature ||
                    c instanceof StandardKnowledge
            )
        const parent = parentComponent ?? parentFromStack
        if (!parent) {
            continue
        }

        const facet = findFacetForSituation(parent, situationId)
        if (!facet) {
            continue
        }

        const parentAssetStack = getOrderedAssetStack(parentId, assetId, parentByAssets)

        if (eventType === 'Component Removed') {
            await emitSituationFacetRemovedForParent({
                parentId,
                situationId,
                assetStack: parentAssetStack,
                parentByAssets,
                situationByAssets,
                streamEvent,
            })
            continue
        }

        const lensMarksWithDefaults =
            parent instanceof StandardRoom
                ? await resolveLensMarksWithDefaultsForRoom(parent, parentByAssets, parentAssetStack)
                : undefined

        await emitSituationFacetUpdatedForParent({
            parentId,
            situationId,
            assetStack: parentAssetStack,
            parentByAssets,
            situationByAssets,
            situationComponent: mergedSituation,
            facet,
            lensMarksWithDefaults,
            streamEvent,
        })
    }
}

export const componentExamplesDataSource = new AssetsDataSource<
    never,
    ComponentExamplesEventUpdate,
    ComponentExamplesSubscribedContent
>({
    dataSourceKey: 'mtw.assets.componentExamples',
    replayable: false,
    subscribedEventTypeGuard: isComponentExamplesSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(
            events.map(async (event) => {
                if (!isComponentExamplesSubscribedEnvelope(event)) {
                    return
                }
                const content = await event.getContent()
                const assetId = event.header.streamKey as AssetUUID
                const eventType = event.header.type

                if (content.component.tag === 'Room') {
                    const room = content.component as StandardRoom
                    const roomId = room.universalKey as ComponentUUID
                    await emitParentSituationFacetEvents({
                        parent: room,
                        parentId: roomId,
                        assetId,
                        eventType,
                        streamEvent,
                        includeLensMarks: true,
                    })
                    return
                }

                if (content.component.tag === 'Feature' || content.component.tag === 'Knowledge') {
                    const parent = content.component as StandardFeature | StandardKnowledge
                    const parentId = parent.universalKey as ComponentUUID
                    await emitParentSituationFacetEvents({
                        parent,
                        parentId,
                        assetId,
                        eventType,
                        streamEvent,
                        includeLensMarks: false,
                    })
                    return
                }

                if (content.component.tag === 'Situation' && content.component.universalKey) {
                    const situation = content.component as StandardSituation
                    const situationId = situation.universalKey as ComponentUUID
                    await emitSituationComponentFacetEvents({
                        situation,
                        situationId,
                        assetId,
                        eventType,
                        streamEvent,
                    })
                    return
                }

            })
        )
    },
})

componentExamplesDataSource.subscribe()

export default componentExamplesDataSource
