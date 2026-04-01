/**
 * Payload contracts for internal render-orchestration ingress events.
 *
 * Transitional note:
 * - These are in-process only (dataSourceKey: 'api.ephemera').
 * - This module supports an ingress adapter migration and is not a precedent
 *   for full DataSource contract design.
 */
import type { RenderPreviewRequested, RenderRequested } from '../../renderOrchestration/events'

export type RenderRequestedCommand = Omit<RenderRequested, 'type'>
export type RenderPreviewRequestedCommand = Omit<RenderPreviewRequested, 'type'>

export type RenderOrchestrationIngressCommand =
    | RenderRequestedCommand
    | RenderPreviewRequestedCommand

export const isRenderRequestedCommand = (value: unknown): value is RenderRequestedCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        typeof v.componentId === 'string' &&
        !!v.perspective &&
        typeof v.perspective === 'object'
    )
}

export const isRenderPreviewRequestedCommand = (value: unknown): value is RenderPreviewRequestedCommand => {
    if (!isRenderRequestedCommand(value)) {
        return false
    }
    const v = value as Record<string, unknown>
    return !!v.markState && typeof v.markState === 'object'
}
