/**
 * Outbound bus events for mtw.ephemera.renderCache (bus-only DataSource).
 */
import type { EphemeraCacheComponentId } from '../../renderCache/baseClasses'

export const RENDER_CACHE_DATA_SOURCE_KEY = 'mtw.ephemera.renderCache' as const

export type RenderCacheCacheUpdatedPayload = {
    type: 'Cache Updated';
    componentId: EphemeraCacheComponentId;
    dataCategory: string;
    perspectiveId: string;
    /** Prototype: echoed from Put Cache Record command; remove when external orchestration correlates without DS plumbing (see conversations/AGENT.md). */
    conversationId?: string;
}

export type RenderCacheCacheErrorPayload = {
    type: 'Cache Error';
    componentId: EphemeraCacheComponentId;
    errorCode: string;
    errorMessage: string;
    perspectiveId?: string;
}

export type RenderCacheCacheDeletedPayload = {
    type: 'Cache Deleted';
    componentId: EphemeraCacheComponentId;
    dataCategories: string[];
}

export const isRenderCacheCacheDeletedPayload = (value: unknown): value is RenderCacheCacheDeletedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        v.type === 'Cache Deleted' &&
        typeof v.componentId === 'string' &&
        Array.isArray(v.dataCategories) &&
        v.dataCategories.every((x) => typeof x === 'string')
    )
}

export type RenderCacheUpdatePayload = RenderCacheCacheUpdatedPayload | RenderCacheCacheDeletedPayload | RenderCacheCacheErrorPayload

export const isRenderCacheCacheUpdatedPayload = (value: unknown): value is RenderCacheCacheUpdatedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (
        v.type !== 'Cache Updated' ||
        typeof v.componentId !== 'string' ||
        typeof v.dataCategory !== 'string' ||
        typeof v.perspectiveId !== 'string'
    ) {
        return false
    }
    if (v.conversationId !== undefined && typeof v.conversationId !== 'string') {
        return false
    }
    return true
}

export const isRenderCacheCacheErrorPayload = (value: unknown): value is RenderCacheCacheErrorPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Cache Error' || typeof v.componentId !== 'string') {
        return false
    }
    if (typeof v.errorCode !== 'string' || typeof v.errorMessage !== 'string') {
        return false
    }
    if (v.perspectiveId !== undefined && typeof v.perspectiveId !== 'string') {
        return false
    }
    return true
}
