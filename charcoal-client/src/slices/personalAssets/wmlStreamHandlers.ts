import type { AppDispatch } from '../../store'
import { StreamEventPubSub } from '../dataSource/streamEventPubSub'
import { receiveWMLEvent } from './index'
import type { WMLStreamingEventHeader, WMLContentEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * Clear pendingEdits before wmlDataSource applies Content Update to base.
 * wmlDataSource subscribes later (on SSM INITIALIZE); this handler uses subscribeFirst
 * at store startup so pending is cleared before base merge (avoids base + pending double).
 */
export const registerPersonalAssetsWmlStreamHandlers = (dispatch: AppDispatch): void => {
    StreamEventPubSub.subscribeFirst(({ payload }) => {
        if (payload.dataSourceKey !== 'mtw.wml') {
            return
        }
        const header = payload.header as WMLStreamingEventHeader
        const { RequestIds } = header
        if (!RequestIds?.length) {
            return
        }
        if (!isSchemaAssetUUID(payload.streamKey)) {
            return
        }
        ;(dispatch as (action: unknown) => unknown)(
            receiveWMLEvent(payload.streamKey)({
                header,
                content: payload.content as WMLContentEvent
            })
        )
    })
}
