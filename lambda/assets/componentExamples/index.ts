//
// Non-replayable DataSource for mtw.assets.componentExamples
//
// Subscribes to mtw.assets Component Updated / Component Removed and filters to
// Example-associated components only (Example, Room, Feature, Knowledge).
// Phase 2a Task 2: filter only; no enrichment or publishing yet.
//
import { AssetsDataSource } from '../dataSource/abstract'
import { ComponentEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { isExampleAssociatedComponent } from './exampleAssociatedFilter'
import {
    ComponentExamplesSubscribedContent,
    isComponentExamplesSubscribedEnvelope,
} from './subscribedEvents'

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
                // Example-associated event; no enrichment or publishing yet (Phase 2a Task 3+).
            })
        )
    },
})

componentExamplesDataSource.subscribe()

export default componentExamplesDataSource
