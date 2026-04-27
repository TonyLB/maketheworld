/**
 * Payload contracts for internal render-orchestration ingress events.
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/renderOrchestration/AGENT.md.
 */
import type { RenderRequested } from '../../messageBus/baseClasses'

export type RenderRequestedCommand = Omit<RenderRequested, 'type'>

export type RenderOrchestrationIngressCommand = RenderRequestedCommand

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
