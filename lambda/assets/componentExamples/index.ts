//
// Non-replayable DataSource for mtw.assets.componentExamples
//
// Subscribes to mtw.assets Component Updated / Component Removed and publishes
// Example-lifecycle events for Example-associated components (Example, Feature, Knowledge per
// exampleAssociatedFilter) plus Room Situation-facet mirror events.
// "Example" in event names is legacy.
//
import { AssetsDataSource } from '../dataSource/abstract'
import { isExampleAssociatedComponent } from './exampleAssociatedFilter'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import {
    ComponentExamplesSubscribedContent,
    isComponentExamplesSubscribedEnvelope,
} from './subscribedEvents'
import {
    computePerspectiveMatcherForRoomSituation,
    enrichExampleEvent,
    getOrderedAssetStack,
    mergeLensAcrossStack,
    mergeRoomAcrossStack,
    situationFacetToCacheShape,
} from './exampleEnrichment'
import { getLensMarksWithDefaults } from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardSituationRoomFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import {
    ComponentExamplesEventUpdate,
    ExampleRemoved,
    ExampleUpdated,
} from './events'

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

                // Room with situations: emit one event per situation facet (exampleId = situation uuid).
                if (content.component.tag === 'Room') {
                    const room = content.component as StandardRoom
                    const roomId = room.universalKey as ComponentUUID
                    const [roomData] = await internalCache.ComponentData.get([roomId as EphemeraId])
                    const byAssets = roomData?.byAssets ?? []
                    // Use content-mode Room from cache for this asset when available (post-write state),
                    // so we publish full render payloads instead of edit fragments from the diff.
                    const contentRoom = byAssets.find((a) => a.AssetId === assetId)?.component as StandardRoom | undefined
                    const roomForPayload = contentRoom ?? room
                    const assetStack = getOrderedAssetStack(roomId, assetId, byAssets)

                    const mergedRoom = mergeRoomAcrossStack(byAssets, assetStack) ?? roomForPayload
                    const lensRef = mergedRoom?.lens?.payload?.[0]
                    const lensId = lensRef?.universalKey as ComponentUUID | undefined
                    let lensMarksWithDefaults = undefined as
                        | ReturnType<typeof getLensMarksWithDefaults>
                        | undefined

                    if (lensId) {
                        const [lensData] = await internalCache.ComponentData.get([lensId as EphemeraId])
                        const lensByAssets = lensData?.byAssets ?? []
                        if (lensByAssets.length) {
                            const eventLensAssetId = lensByAssets[lensByAssets.length - 1]?.AssetId as AssetUUID
                            const lensAssetStack = getOrderedAssetStack(lensId, eventLensAssetId, lensByAssets)
                            const mergedLens = mergeLensAcrossStack(lensByAssets, lensAssetStack)
                            if (mergedLens) {
                                lensMarksWithDefaults = getLensMarksWithDefaults(mergedLens)
                            }
                        }
                    }

                    const situationsListForPayload = roomForPayload.situations?.items ?? []
                    if (situationsListForPayload.length === 0) {
                        return
                    }
                    const situationIds = situationsListForPayload.map(
                        (f) => (f as StandardSituationRoomFacet).reference.universalKey
                    )
                    const situationCaches = await internalCache.ComponentData.get(situationIds as EphemeraId[])

                    if (eventType === 'Component Removed') {
                        for (let idx = 0; idx < situationIds.length; idx++) {
                            const situationId = situationIds[idx]
                            if (!situationId) continue
                            const situationCache = situationCaches[idx]
                            const perspectiveMatcher = computePerspectiveMatcherForRoomSituation({
                                roomId,
                                situationId: situationId as ComponentUUID,
                                assetStack,
                                roomByAssets: byAssets,
                                situationByAssets: situationCache?.byAssets ?? [],
                            })
                            await streamEvent({
                                update: {
                                    type: 'ExampleRemoved',
                                    exampleId: situationId as ComponentUUID,
                                    parentIds: [roomId],
                                    assetStack,
                                    perspectiveMatcher,
                                },
                                streamKey: situationId,
                                header: { type: 'ExampleRemoved' },
                            })
                        }
                        return
                    }

                    for (let i = 0; i < situationsListForPayload.length; i++) {
                        const facet = situationsListForPayload[i] as StandardSituationRoomFacet
                        const situationId = facet.reference.universalKey as ComponentUUID
                        const cache = situationCaches[i]
                        const situationComponent = cache?.byAssets?.find(
                            (a) => a.component instanceof StandardSituation
                        )?.component as StandardSituation | undefined
                        if (!situationComponent) {
                            continue
                        }
                        const perspectiveMatcher = computePerspectiveMatcherForRoomSituation({
                            roomId,
                            situationId,
                            assetStack,
                            roomByAssets: byAssets,
                            situationByAssets: cache?.byAssets ?? [],
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
                                parentIds: [roomId],
                                assetStack,
                                perspectiveMatcher,
                                example: examplePayload,
                            },
                            streamKey: situationId,
                            header: { type: 'ExampleUpdated' },
                        })
                    }
                    return
                }

                if (!isExampleAssociatedComponent(content.component)) {
                    return
                }

                // Example component: existing path.
                if (content.component.tag !== 'Example' || !content.component.universalKey) {
                    return
                }

                const enriched = await enrichExampleEvent({
                    exampleId: content.component.universalKey as ComponentUUID,
                    eventAssetId: assetId,
                    component: content.component,
                    eventType,
                })

                const streamKey = enriched.exampleId

                if (eventType === 'Component Removed') {
                    // Temporary band-aid until Feature/Knowledge are refactored to Situations; edge-cases acceptable for the interim.
                    const perspectiveMatcher: { requiredAssetIds: AssetUUID[]; forbiddenAssetIds: AssetUUID[] } = {
                        requiredAssetIds: enriched.assetStack,
                        forbiddenAssetIds: [],
                    }
                    const update: ExampleRemoved = {
                        type: 'ExampleRemoved',
                        exampleId: enriched.exampleId,
                        parentIds: enriched.parentIds,
                        assetStack: enriched.assetStack,
                        perspectiveMatcher,
                    }
                    await streamEvent({
                        update,
                        streamKey,
                        header: { type: 'ExampleRemoved' },
                    })
                    return
                }

                if (eventType === 'Component Updated') {
                    if (!enriched.example) {
                        return
                    }
                    // Temporary band-aid until Feature/Knowledge are refactored to Situations; edge-cases acceptable for the interim.
                    const perspectiveMatcher: { requiredAssetIds: AssetUUID[]; forbiddenAssetIds: AssetUUID[] } = {
                        requiredAssetIds: enriched.assetStack,
                        forbiddenAssetIds: [],
                    }
                    const update: ExampleUpdated = {
                        type: 'ExampleUpdated',
                        exampleId: enriched.exampleId,
                        parentIds: enriched.parentIds,
                        assetStack: enriched.assetStack,
                        perspectiveMatcher,
                        example: enriched.example,
                    }
                    await streamEvent({
                        update,
                        streamKey,
                        header: { type: 'ExampleUpdated' },
                    })
                    return
                }
            })
        )
    },
})

componentExamplesDataSource.subscribe()

export default componentExamplesDataSource
