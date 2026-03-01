//
// Non-replayable DataSource for mtw.assets.componentExamples
//
// Subscribes to mtw.assets Component Updated / Component Removed and filters to
// Example-associated components only (Example, Room, Feature, Knowledge).
// Events on this stream may carry Situation ids and situation-facet payloads (Phase 3);
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
    enrichExampleEvent,
    getOrderedAssetStack,
    situationFacetToCacheShape,
} from './exampleEnrichment'
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
                if (!isExampleAssociatedComponent(content.component)) {
                    return
                }
                const assetId = event.header.streamKey as AssetUUID
                const eventType = event.header.type

                // Room with situations: emit one event per situation facet (exampleId = situation uuid).
                if (content.component.tag === 'Room') {
                    const room = content.component as StandardRoom
                    const situationsList = room.situations?.items ?? []
                    if (situationsList.length === 0) {
                        return
                    }
                    const roomId = room.universalKey as ComponentUUID
                    const [roomData] = await internalCache.ComponentData.get([roomId as EphemeraId])
                    const byAssets = roomData?.byAssets ?? []
                    const assetStack = getOrderedAssetStack(roomId, assetId, byAssets)
                    const situationIds = situationsList.map(
                        (f) => (f as StandardSituationRoomFacet).reference.universalKey
                    )
                    const situationCaches = await internalCache.ComponentData.get(situationIds as EphemeraId[])

                    if (eventType === 'Component Removed') {
                        for (const situationId of situationIds) {
                            if (!situationId) continue
                            await streamEvent({
                                update: {
                                    type: 'ExampleRemoved',
                                    exampleId: situationId as ComponentUUID,
                                    parentIds: [roomId],
                                    assetStack,
                                },
                                streamKey: situationId,
                                header: { type: 'ExampleRemoved' },
                            })
                        }
                        return
                    }

                    for (let i = 0; i < situationsList.length; i++) {
                        const facet = situationsList[i] as StandardSituationRoomFacet
                        const situationId = facet.reference.universalKey as ComponentUUID
                        const cache = situationCaches[i]
                        const situationComponent = cache?.byAssets?.find(
                            (a) => a.component instanceof StandardSituation
                        )?.component as StandardSituation | undefined
                        if (!situationComponent) {
                            continue
                        }
                        const examplePayload = situationFacetToCacheShape(
                            situationComponent,
                            facet.payload
                        )
                        await streamEvent({
                            update: {
                                type: 'ExampleUpdated',
                                exampleId: situationId,
                                parentIds: [roomId],
                                assetStack,
                                example: examplePayload,
                            },
                            streamKey: situationId,
                            header: { type: 'ExampleUpdated' },
                        })
                    }
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
                    const update: ExampleRemoved = {
                        type: 'ExampleRemoved',
                        exampleId: enriched.exampleId,
                        parentIds: enriched.parentIds,
                        assetStack: enriched.assetStack,
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
                    const update: ExampleUpdated = {
                        type: 'ExampleUpdated',
                        exampleId: enriched.exampleId,
                        parentIds: enriched.parentIds,
                        assetStack: enriched.assetStack,
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
