/**
 * Payload contracts for internal render-orchestration ingress events.
 *
 * In-process only (dataSourceKey: 'api.ephemera'). Part of the evolving DataSource
 * under dataSource/renderOrchestration/ (see AGENT.md); contracts may expand at graduation.
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
