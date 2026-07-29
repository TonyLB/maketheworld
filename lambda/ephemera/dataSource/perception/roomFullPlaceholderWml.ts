import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'

/**
 * TEMPORARY: Word joiner (U+2060) as non-whitespace display title so WML round-trips.
 * `packages/mtw-wml/ts/schema/converters/components.ts` `Render.finalize` currently requires
 * exactly three ordered children (DisplayName, Summary, Description) and rejects an empty
 * DisplayName after trim. Remove this constant once `Render.finalize` (and matching emit/standardize
 * behavior) are loosened so partial or empty DisplayName/Summary can round-trip; then use a normal
 * empty or omitted display name in `placeholderRoomFullWml` instead.
 */
const PLACEHOLDER_RENDER_INVISIBLE_TITLE = '\u2060'

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
        displayName: [PLACEHOLDER_RENDER_INVISIBLE_TITLE],
        summary: [''],
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
