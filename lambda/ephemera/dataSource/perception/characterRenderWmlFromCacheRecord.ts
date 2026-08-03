import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardCharacterData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/character'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'
import { selectDefaultSituationCacheRecord } from '../renderCache/selectDefaultSituationCacheRecord'

/** Empty cache shape: yields Character with no Render facet (prose-free). */
const EMPTY_CACHE_RENDERED_CONTENT: EphemeraCacheRenderedContent = {
    description: [],
}

/**
 * Render-channel WML for imperative Character perception: prose from `renderCache` only.
 */
export function characterRenderWmlFromCacheRecord(
    characterId: EphemeraCharacterId,
    renderedContent: EphemeraCacheRenderedContent
): string {
    const renderPayload = situationRoomRenderPayloadFromCacheRenderedContent(renderedContent)
    const characterRow: StandardCharacterData = {
        tag: 'Character',
        universalKey: characterId,
        ...(renderPayload ? { render: renderPayload } : {}),
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        characterRow,
    ], { standardizeMode: 'ephemeraWire' })
    return schemaToWML([form.schema])
}

/**
 * Character perception WML from cache rows: selects SITUATION#DEFAULT only (D9).
 */
export function characterRenderChannelWmlForCharacterId(
    characterId: EphemeraCharacterId,
    cacheRecords: EphemeraCacheDynamoItem[]
): string {
    const record = selectDefaultSituationCacheRecord(cacheRecords)
    if (!record) {
        return characterRenderWmlFromCacheRecord(characterId, EMPTY_CACHE_RENDERED_CONTENT)
    }
    return characterRenderWmlFromCacheRecord(characterId, record.renderedContent)
}
