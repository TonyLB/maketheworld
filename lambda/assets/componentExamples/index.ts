//
// Non-replayable DataSource for mtw.assets.componentExamples
//
// Subscribes to mtw.assets Component Updated / Component Removed and publishes
// ExampleInvalidated (no example body) for Ephemera renderCache catalog bumps.
//
import { AssetsDataSource } from '../dataSource/abstract'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import {
    ComponentExamplesSubscribedContent,
    isComponentExamplesSubscribedEnvelope,
} from './subscribedEvents'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardSituationProseFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import type {
    ComponentExamplesEventUpdate,
    ComponentExamplesInvalidatedEvent,
    ComponentScopedExampleInvalidatedEvent,
    SituationScopedExampleInvalidatedEvent,
} from './events'

type ParentWithSituationFacets = StandardRoom | StandardFeature | StandardKnowledge

type StreamEventFn = (params: {
    update: ComponentExamplesInvalidatedEvent;
    streamKey: string;
    header: { type: 'ExampleInvalidated' };
}) => Promise<void>

const collectAffectedSituationIds = (
    parent: ParentWithSituationFacets
): ComponentUUID[] | undefined => {
    const items = parent.situations?.items ?? []
    const ids = items
        .map(
            (f) =>
                (f as StandardSituationProseFacet).reference?.universalKey as
                    | ComponentUUID
                    | undefined
        )
        .filter((id): id is ComponentUUID => Boolean(id))
    return ids.length > 0 ? ids : undefined
}

const emitComponentScopedInvalidation = async (params: {
    componentId: ComponentUUID;
    editAssetId: AssetUUID;
    parent: ParentWithSituationFacets;
    streamEvent: StreamEventFn;
}): Promise<void> => {
    const { componentId, editAssetId, parent, streamEvent } = params
    const affectedSituationIds = collectAffectedSituationIds(parent)
    const update: ComponentScopedExampleInvalidatedEvent = {
        type: 'ExampleInvalidated',
        componentIds: [componentId],
        editAssetId,
        ...(affectedSituationIds ? { affectedSituationIds } : {}),
    }
    await streamEvent({
        update,
        streamKey: editAssetId,
        header: { type: 'ExampleInvalidated' },
    })
}

const emitSituationScopedInvalidation = async (params: {
    situationId: ComponentUUID;
    editAssetId: AssetUUID;
    entityRemoved: boolean;
    streamEvent: StreamEventFn;
}): Promise<void> => {
    const { situationId, editAssetId, entityRemoved, streamEvent } = params
    const update: SituationScopedExampleInvalidatedEvent = {
        type: 'ExampleInvalidated',
        situationId,
        editAssetId,
        ...(entityRemoved ? { entityRemoved: true } : {}),
    }
    await streamEvent({
        update,
        streamKey: editAssetId,
        header: { type: 'ExampleInvalidated' },
    })
}

export const componentExamplesDataSource = new AssetsDataSource<
    never,
    ComponentExamplesEventUpdate,
    ComponentExamplesSubscribedContent
>({
    dataSourceKey: 'mtw.assets.componentExamples',
    outboundBusDelivery: 'publish',
    replayable: false,
    subscribedEventTypeGuard: isComponentExamplesSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(
            events.map(async (event) => {
                if (!isComponentExamplesSubscribedEnvelope(event)) {
                    return
                }
                const content = await event.getContent()
                const editAssetId = event.header.streamKey as AssetUUID
                const entityRemoved = event.header.type === 'Component Removed'

                if (content.component.tag === 'Room') {
                    const room = content.component as StandardRoom
                    const roomId = room.universalKey as ComponentUUID
                    await emitComponentScopedInvalidation({
                        componentId: roomId,
                        editAssetId,
                        parent: room,
                        streamEvent,
                    })
                    return
                }

                if (content.component.tag === 'Feature' || content.component.tag === 'Knowledge') {
                    const parent = content.component as StandardFeature | StandardKnowledge
                    const parentId = parent.universalKey as ComponentUUID
                    await emitComponentScopedInvalidation({
                        componentId: parentId,
                        editAssetId,
                        parent,
                        streamEvent,
                    })
                    return
                }

                if (content.component.tag === 'Situation' && content.component.universalKey) {
                    const situationId = content.component.universalKey as ComponentUUID
                    await emitSituationScopedInvalidation({
                        situationId,
                        editAssetId,
                        entityRemoved,
                        streamEvent,
                    })
                }
            })
        )
    },
})

componentExamplesDataSource.subscribe()

export default componentExamplesDataSource
