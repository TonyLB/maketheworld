import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { renderTreeToString } from '@tonylb/mtw-base/ts/renderTree'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardObjectData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/object'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { selectDefaultSituationCacheRecord } from '../renderCache/selectDefaultSituationCacheRecord'

const EMPTY_CACHE_RENDERED_CONTENT: EphemeraCacheRenderedContent = {
    description: [],
}

/**
 * TEMPORARY: word joiner (U+2060) as non-whitespace placeholder shortName, mirroring
 * `orchestrate.ts`'s `PLACEHOLDER_RENDER_INVISIBLE_TITLE` workaround for the same underlying WML
 * constraint. `<Object>`'s content model (`schema/converters/components.ts`) requires exactly one
 * non-empty `ShortName` child --- always, structurally, unlike Feature/Knowledge's optional `Render`
 * facet --- so an Object row with no resolvable text still needs *something* here to round-trip.
 */
const PLACEHOLDER_SHORT_NAME = '⁠'

/**
 * Render-channel WML for Object: built from `shortName` --- the field `StandardObject` already fully
 * supports (parse-consumer, type, and `schema()` emitter) --- rather than mirroring
 * `featureRenderWmlFromCacheRecord`/`knowledgeRenderWmlFromCacheRecord`'s `.render` mechanism, which
 * `StandardObject` has no wired consumer for yet. `renderedContent.displayName` comes from the real
 * `ensureAuthoredCatalog` path's `SITUATION#DEFAULT` facet (authored-only, may be empty); `fallbackShortName`
 * --- the object's own live-resolved shortName, from `objects/objectShortName.ts`'s
 * `resolveObjectShortName` --- fills in when no facet has been authored, so Object never renders
 * nameless.
 */
export function objectRenderWmlFromCacheRecord(
    objectId: EphemeraObjectId,
    renderedContent: EphemeraCacheRenderedContent,
    { fallbackShortName }: { fallbackShortName?: string } = {}
): string {
    const resolved = renderedContent.displayName ? renderTreeToString(renderedContent.displayName) : ''
    const shortName = resolved.length > 0 ? resolved : (fallbackShortName || PLACEHOLDER_SHORT_NAME)
    const objectRow: StandardObjectData = {
        tag: 'Object',
        universalKey: objectId,
        shortName,
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
