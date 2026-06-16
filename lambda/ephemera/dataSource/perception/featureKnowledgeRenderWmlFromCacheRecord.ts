import type { EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardFeatureData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/feature'
import type { StandardKnowledgeData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/knowledge'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'
import { selectDefaultSituationCacheRecord } from '../renderCache/selectDefaultSituationCacheRecord'

/** Empty cache shape: yields Feature/Knowledge with no Render facet (prose-free). */
const EMPTY_CACHE_RENDERED_CONTENT: EphemeraCacheRenderedContent = {
    description: [],
}

/**
 * Render-channel WML for imperative Feature perception: prose from `renderCache` only.
 */
export function featureRenderWmlFromCacheRecord(
    featureId: EphemeraFeatureId,
    renderedContent: EphemeraCacheRenderedContent
): string {
    const renderPayload = situationRoomRenderPayloadFromCacheRenderedContent(renderedContent)
    const featureRow: StandardFeatureData = {
        tag: 'Feature',
        universalKey: featureId,
        ...(renderPayload ? { render: renderPayload } : {}),
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        featureRow,
    ], { standardizeMode: 'ephemeraWire' })
    return schemaToWML([form.schema])
}

/**
 * Render-channel WML for imperative Knowledge perception: prose from `renderCache` only.
 */
export function knowledgeRenderWmlFromCacheRecord(
    knowledgeId: EphemeraKnowledgeId,
    renderedContent: EphemeraCacheRenderedContent
): string {
    const renderPayload = situationRoomRenderPayloadFromCacheRenderedContent(renderedContent)
    const knowledgeRow: StandardKnowledgeData = {
        tag: 'Knowledge',
        universalKey: knowledgeId,
        ...(renderPayload ? { render: renderPayload } : {}),
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        knowledgeRow,
    ], { standardizeMode: 'ephemeraWire' })
    return schemaToWML([form.schema])
}

/**
 * Feature perception WML from cache rows: selects SITUATION#DEFAULT only (D9).
 */
export function featureRenderChannelWmlForFeatureId(
    featureId: EphemeraFeatureId,
    cacheRecords: EphemeraCacheDynamoItem[]
): string {
    const record = selectDefaultSituationCacheRecord(cacheRecords)
    if (!record) {
        return featureRenderWmlFromCacheRecord(featureId, EMPTY_CACHE_RENDERED_CONTENT)
    }
    return featureRenderWmlFromCacheRecord(featureId, record.renderedContent)
}

/**
 * Knowledge perception WML from cache rows: selects SITUATION#DEFAULT only (D9).
 */
export function knowledgeRenderChannelWmlForKnowledgeId(
    knowledgeId: EphemeraKnowledgeId,
    cacheRecords: EphemeraCacheDynamoItem[]
): string {
    const record = selectDefaultSituationCacheRecord(cacheRecords)
    if (!record) {
        return knowledgeRenderWmlFromCacheRecord(knowledgeId, EMPTY_CACHE_RENDERED_CONTENT)
    }
    return knowledgeRenderWmlFromCacheRecord(knowledgeId, record.renderedContent)
}
