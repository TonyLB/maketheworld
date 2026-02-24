//
// Non-replayable DataSource for mtw.assets.componentExamples
//
// Subscribes to mtw.assets Component Updated / Component Removed and filters to
// Example-associated components only (Example, Room, Feature, Knowledge).
// Phase 2a Tasks 2–3: filter and enrichment; Phase 2a Task 4 adds publishing
// of Example lifecycle events (ExampleAdded, ExampleRemoved, ExampleUpdated).
//
import { AssetsDataSource } from '../dataSource/abstract'
import { isExampleAssociatedComponent } from './exampleAssociatedFilter'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import {
    ComponentExamplesSubscribedContent,
    isComponentExamplesSubscribedEnvelope,
} from './subscribedEvents'
import { enrichExampleEvent } from './exampleEnrichment'
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
                if (content.component.tag !== 'Example' || !content.component.universalKey) {
                    return
                }

                const assetId = event.header.streamKey as AssetUUID
                const eventType = event.header.type

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
