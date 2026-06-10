//
// Non-replayable DataSource for mtw.assets.components.verticals
//
// Subscribes to mtw.assets component events and projects Meta::Import hop rows per universal component id.
//
import { AssetsDataSource } from '../../abstract'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isComponentVerticalMisalignedFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import {
    ComponentVerticalsSubscribedContent,
    isComponentVerticalsSubscribedEnvelope,
} from './subscribedEvents'
import { healComponentVertical } from './healComponentVertical'
import { projectImportVerticalHop } from './projectImportVerticalHop'
import type { ImportVerticalHeaderType } from './projectImportVerticalHop'

function headerToVerticalType(
    type: string
): ImportVerticalHeaderType | undefined {
    if (type === 'Component Updated' || type === 'Component Republished' || type === 'Component Removed') {
        return type
    }
    return undefined
}

export const componentVerticalsDataSource = new AssetsDataSource<
    never,
    never,
    ComponentVerticalsSubscribedContent
>({
    dataSourceKey: 'mtw.assets.components.verticals',
    outboundBusDelivery: 'publish',
    replayable: false,
    subscribedEventTypeGuard: isComponentVerticalsSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(
            events.map(async (event) => {
                if (!isComponentVerticalsSubscribedEnvelope(event)) {
                    return
                }
                if (
                    event.header.dataSourceKey === 'mtw.diagnostics' &&
                    event.header.type === 'Component Vertical Misaligned Finding'
                ) {
                    const finding = await event.getContent()
                    if (!isComponentVerticalMisalignedFindingEvent(finding)) {
                        return
                    }
                    await healComponentVertical({ assetId: finding.assetId })
                    return
                }
                const verticalType = headerToVerticalType(event.header.type)
                if (!verticalType) {
                    return
                }
                const content = await event.getContent()
                if (!('component' in content)) {
                    return
                }
                const childAssetId = event.header.streamKey as AssetUUID
                await projectImportVerticalHop({
                    headerType: verticalType,
                    component: content.component,
                    childAssetId,
                })
            })
        )
    },
})

componentVerticalsDataSource.subscribe()

export default componentVerticalsDataSource
