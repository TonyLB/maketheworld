import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'

/** Empty cache shape: `roomRenderWmlFromCacheRecord` yields a Room with no Render facet (prose-free; structure from affordance channel). */
const EMPTY_ROOM_CACHE_RENDERED_CONTENT: EphemeraCacheRenderedContent = {
    description: [],
}

/**
 * Render-channel WML for imperative `PerceptionRoomMessage`, aligned with `ComponentRender` + `RenderCache` first-row choice.
 * Uses the first `cacheRecords[0]` when non-empty; otherwise the same empty `renderedContent` as a cache miss.
 */
export function roomRenderChannelWmlForRoomId(
    roomId: EphemeraRoomId,
    cacheRecords: EphemeraCacheDynamoItem[]
): string {
    const first = cacheRecords[0]
    if (!first) {
        return roomRenderWmlFromCacheRecord(roomId, EMPTY_ROOM_CACHE_RENDERED_CONTENT)
    }
    return roomRenderWmlFromCacheRecord(roomId, first.renderedContent)
}

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
