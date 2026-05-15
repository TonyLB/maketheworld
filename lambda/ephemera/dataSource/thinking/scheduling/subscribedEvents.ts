/**
 * Ingress for mtw.ephemera.thinking.scheduling: api.ephemera Put Thinking Schedule,
 * Put Thinking Job Create, and Put Thinking Job Error commands.
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import {
    isEphemeraApiPutThinkingJobCreateEnvelope,
    isEphemeraApiPutThinkingJobErrorEnvelope,
    isEphemeraApiPutThinkingScheduleEnvelope,
} from '../../apiEphemera'
import type {
    PutThinkingJobCreateCommand,
    PutThinkingJobErrorCommand,
    PutThinkingScheduleCommand,
} from '../../localApiEvents'

export type ThinkingSchedulingSubscribedCommand =
    | PutThinkingScheduleCommand
    | PutThinkingJobCreateCommand
    | PutThinkingJobErrorCommand

export const isThinkingSchedulingSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ThinkingSchedulingSubscribedCommand> =>
    isEphemeraApiPutThinkingScheduleEnvelope(envelope)
    || isEphemeraApiPutThinkingJobCreateEnvelope(envelope)
    || isEphemeraApiPutThinkingJobErrorEnvelope(envelope)
