import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardObjectData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/object'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'
import { selectDefaultSituationCacheRecord } from '../renderCache/selectDefaultSituationCacheRecord'

const EMPTY_CACHE_RENDERED_CONTENT: EphemeraCacheRenderedContent = {
    description: [],
}

/**
 * Word joiner (U+2060) as non-whitespace placeholder shortName. `<Object>`'s content model
 * (`schema/converters/components.ts`) requires exactly one non-empty `ShortName` child ---
 * always, structurally, unlike Feature/Knowledge's optional `Render` facet --- so an Object row
 * with no resolvable text still needs *something* here to round-trip.
 */
const PLACEHOLDER_SHORT_NAME = '⁠'

/**
 * Render-channel WML for Object: prose from `renderCache` via `.render`, mirroring
 * `featureRenderWmlFromCacheRecord`/`knowledgeRenderWmlFromCacheRecord`, *plus* a `shortName` --- unlike
 * Feature/Knowledge, `<Object>`'s content model structurally requires exactly one non-empty
 * `ShortName` child, so both facets are emitted together.
 *
 * `<ShortName>` and `<Render><DisplayName>` are distinct fields (e.g. `ShortName` "Agatha" vs.
 * `DisplayName` "Agatha Panzer von Sparkles III") and are kept separate here: `shortName` comes
 * only from `fallbackShortName` --- the object's own live-resolved shortName, from
 * `objects/objectShortName.ts`'s `resolveObjectShortName` --- falling back to `PLACEHOLDER_SHORT_NAME`
 * when unresolved, so Object never renders nameless. `renderedContent` (including any authored
 * `displayName`) passes straight through to the `<Render>` facet, exactly like Room/Feature/
 * Knowledge/Character.
 */
export function objectRenderWmlFromCacheRecord(
    objectId: EphemeraObjectId,
    renderedContent: EphemeraCacheRenderedContent,
    { fallbackShortName }: { fallbackShortName?: string } = {}
): string {
    const shortName = fallbackShortName || PLACEHOLDER_SHORT_NAME
    const renderPayload = situationRoomRenderPayloadFromCacheRenderedContent(renderedContent)
    const objectRow: StandardObjectData = {
        tag: 'Object',
        universalKey: objectId,
        shortName,
        ...(renderPayload ? { render: renderPayload } : {}),
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        objectRow,
    ], { standardizeMode: 'ephemeraWire' })
    return schemaToWML([form.schema])
}

/**
 * Object perception WML from cache rows: selects SITUATION#DEFAULT only (mirrors D9's Feature/
 * Knowledge precedent).
 */
export function objectRenderChannelWmlForObjectId(
    objectId: EphemeraObjectId,
    cacheRecords: EphemeraCacheDynamoItem[]
): string {
    const record = selectDefaultSituationCacheRecord(cacheRecords)
    if (!record) {
        return objectRenderWmlFromCacheRecord(objectId, EMPTY_CACHE_RENDERED_CONTENT)
    }
    return objectRenderWmlFromCacheRecord(objectId, record.renderedContent)
}
