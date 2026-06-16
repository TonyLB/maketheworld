import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import {
    SituationRoomFacetPayload,
    type SituationRoomFacetPayloadType,
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import type { EphemeraCacheRenderedContent } from './baseClasses'

function normalizeCacheDisplayName(displayName: unknown): string | undefined {
    if (displayName === undefined || displayName === null) {
        return undefined
    }
    if (typeof displayName === 'string') {
        return displayName
    }
    if (Array.isArray(displayName)) {
        return (displayName as RenderTree).join('')
    }
    return undefined
}

/**
 * Map durable renderCache `renderedContent` to room `<Render>` facet payload (displayName / summary / description).
 * Returns undefined when the facet would be empty (same rules as render-cache first-row room prose).
 */
export function situationRoomRenderPayloadFromCacheRenderedContent(
    renderedContent: EphemeraCacheRenderedContent
): SituationRoomFacetPayloadType | undefined {
    const displayName = normalizeCacheDisplayName(renderedContent.displayName)
    const out: SituationRoomFacetPayloadType = {}
    if (displayName !== undefined && String(displayName).trim()) {
        out.displayName = displayName
    }
    if (renderedContent.summary) {
        out.summary = renderedContent.summary
    }
    if (renderedContent.description !== undefined) {
        out.description = renderedContent.description
    }
    const payloadModel = new SituationRoomFacetPayload(out)
    if (SituationRoomFacetPayload.isEmpty(payloadModel)) {
        return undefined
    }
    return out
}
