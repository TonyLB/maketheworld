//
// Non-replayable DataSource stub for mtw.assets.componentExamples
//
// This DataSource will eventually publish Example lifecycle events (ExampleAdded, ExampleRemoved,
// ExampleUpdated) for Ephemera mirroring. For Phase 2a Task 1 it only subscribes to mtw.assets
// Component Updated / Component Removed and does nothing with events (stub receiveEvents).
//
import { AssetsDataSource } from '../dataSource/abstract'
import { ComponentEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
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
    receiveEvents: async () => {
        // Stub: no enrichment or publishing yet. Events are received and ignored.
    },
})

componentExamplesDataSource.subscribe()

export default componentExamplesDataSource
