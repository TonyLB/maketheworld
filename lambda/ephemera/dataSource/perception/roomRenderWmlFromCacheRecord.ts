import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import type { EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'

/**
 * Render-channel WML for terminal **Render Pertains**: prose from `renderCache` only (no exits, roster, or ComponentStackMerge).
 */
export function roomRenderWmlFromCacheRecord(
    roomId: EphemeraRoomId,
    renderedContent: EphemeraCacheRenderedContent
): string {
    const renderPayload = situationRoomRenderPayloadFromCacheRenderedContent(renderedContent)
    const roomRow: StandardRoomData = {
        tag: 'Room',
        universalKey: roomId,
        ...(renderPayload ? { render: renderPayload } : {}),
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        roomRow,
    ])
    return schemaToWML([form.schema])
}
