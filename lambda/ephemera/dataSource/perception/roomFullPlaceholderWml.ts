import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'

/**
 * Full-room-shaped placeholder WML (Generating/Error), the `format:'full'` sibling of
 * `roomHeaderPlaceholderWml.ts`'s header-shaped placeholders. Used by `deliverListenerContent`
 * (`dataSource/messageOrchestration/index.ts`) to project `roomPlaceholder` content per listener
 * format (Phase 7) --- moved out of `dataSource/perception/orchestrate.ts` once that module
 * stopped needing it directly (roomDescription's own placeholder/error loops were superseded by
 * the shared characterMove/roomDescription/sessionOrientationRender bucket's single report call).
 */
export function placeholderRoomFullWml(roomId: EphemeraRoomId, bodyText: string): string {
    const renderPayload = situationRoomRenderPayloadFromCacheRenderedContent({
        description: [bodyText],
    })
    const roomRow: StandardRoomData = {
        tag: 'Room',
        universalKey: roomId,
        ...(renderPayload ? { render: renderPayload } : {}),
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        roomRow,
    ], { standardizeMode: 'ephemeraWire' })
    return schemaToWML([form.schema])
}
