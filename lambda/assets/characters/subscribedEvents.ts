/**
 * mtw.assets.characters DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Component Updated, Component Removed).
 */
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ComponentEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

export const CONTENT_HEADER_TYPES = new Set(['Component Updated', 'Component Removed'])

/** Payload types of events mtw.assets.characters subscribes to (mtw.assets component events). */
export type CharactersSubscribedContent = ComponentEventUpdate

/** Envelope typeguard: use header only (no content resolution). Enables routing before calling getContentInternal(). */
export const isCharactersComponentEnvelope = (
    event: StreamingEventEnvelope<unknown>
): event is StreamingEventEnvelope<ComponentEventUpdate> & { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' | 'Component Removed' } } => (
    event.header.dataSourceKey === 'mtw.assets' && CONTENT_HEADER_TYPES.has(event.header.type)
)

export function isCharactersSubscribedEnvelope(e: StreamingEventEnvelope<unknown>): e is StreamingEventEnvelope<CharactersSubscribedContent> {
    return e.header.dataSourceKey === 'mtw.assets' && CONTENT_HEADER_TYPES.has(e.header.type)
}
