//
// Non-replayable DataSource for mtw.assets.componentExamples
//
// Subscribes to mtw.assets Component Updated / Component Removed and filters to
// Example-associated components only (Example, Room, Feature, Knowledge).
// Phase 2a Task 2: filter only; Phase 2a Task 3 adds enrichment but no publishing yet.
//
import { AssetsDataSource } from '../dataSource/abstract'
import { ComponentEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { isExampleAssociatedComponent } from './exampleAssociatedFilter'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import {
    ComponentExamplesSubscribedContent,
    isComponentExamplesSubscribedEnvelope,
} from './subscribedEvents'
import { enrichExampleEvent } from './exampleEnrichment'

export const componentExamplesDataSource = new AssetsDataSource<
    never,
    ComponentEventUpdate,
    ComponentExamplesSubscribedContent
>({
    dataSourceKey: 'mtw.assets.componentExamples',
    replayable: false,
    subscribedEventTypeGuard: isComponentExamplesSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(
            events.map(async (event) => {
                if (!isComponentExamplesSubscribedEnvelope(event)) {
                    return
                }
                const content = await event.getContent()
                if (!isExampleAssociatedComponent(content.component)) {
                    return
                }
                //
                // Example-associated event. For Phase 2a Task 3, enrich
                // Example-tagged events with parentIds, assetStack, and
                // merged Example payload. Publishing remains out of scope;
                // enrichment is computed but not streamed.
                //
                if (content.component.tag === 'Example' && content.component.universalKey) {
                    const assetId = event.header.streamKey as `ASSET#${string}`
                    const eventType = event.header.type
                    await enrichExampleEvent({
                        exampleId: content.component.universalKey as ComponentUUID,
                        eventAssetId: assetId,
                        component: content.component,
                        eventType,
                    })
                }
            })
        )
    },
})

componentExamplesDataSource.subscribe()

export default componentExamplesDataSource
