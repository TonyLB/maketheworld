/**
 * Payload contracts for internal affordance-orchestration ingress events.
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/affordanceOrchestration/AGENT.md.
 */
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isPerspective, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

export const AFFORDANCE_ORCHESTRATION_REASONS = ['roster', 'objects', 'topology'] as const

export type AffordanceOrchestrationReason = (typeof AFFORDANCE_ORCHESTRATION_REASONS)[number]

export type AffordancesRequestedCommand = {
    roomId: EphemeraRoomId;
    perspective: Perspective;
    reason: AffordanceOrchestrationReason;
}

export type AffordanceOrchestrationIngressCommand = AffordancesRequestedCommand

export type AffordancesRequested = AffordancesRequestedCommand & {
    type: 'AffordancesRequested';
}

export const isAffordanceOrchestrationReason = (value: unknown): value is AffordanceOrchestrationReason => (
    typeof value === 'string'
    && (AFFORDANCE_ORCHESTRATION_REASONS as readonly string[]).includes(value)
)

export const isAffordancesRequestedCommand = (value: unknown): value is AffordancesRequestedCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        typeof v.roomId === 'string'
        && isEphemeraRoomId(v.roomId)
        && isPerspective(v.perspective)
        && isAffordanceOrchestrationReason(v.reason)
    )
}
