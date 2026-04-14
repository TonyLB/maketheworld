import { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

export type ActionsSubscribedContent = never

/**
 * Inert stub guard for mtw.ephemera.actions.
 * Accepts no inbound envelopes until ingress contracts are defined.
 */
export const isActionsSubscribedEnvelope = (
    _envelope: StreamingEventEnvelope<unknown>
): _envelope is StreamingEventEnvelope<ActionsSubscribedContent> => false
