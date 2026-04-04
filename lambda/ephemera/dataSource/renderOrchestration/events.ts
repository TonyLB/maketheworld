import { Perspective, isPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { EphemeraFeatureId, EphemeraMapId, EphemeraRoomId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId, isEphemeraCharacterId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { MessageGroupId } from '../../internalCache/orchestrateMessages'
import { PublishTarget } from '../../messageBus/baseClasses'
import { EphemeraCacheDynamoItem } from '../../renderCache/baseClasses'

export type RenderComponentId = EphemeraRoomId | EphemeraFeatureId | EphemeraMapId

type RenderTargetContext = {
    characterId?: EphemeraCharacterId;
    targets?: PublishTarget[];
    messageGroupId?: MessageGroupId;
}

/**
 * Which ephemera component and asset-stack perspective a render message refers to.
 * Present on essentially all {@link RenderOrchestrationMessage} variants.
 */
export type RenderComponentPerspective = {
    componentId: RenderComponentId;
    perspective: Perspective;
}

export type RenderRequested = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderRequested';
    allowGeneration?: boolean;
    generationContextWml?: string;
}

/**
 * Subset of {@link RenderRequested} stored on `roomStateRender` conversation rows so materialized
 * `sendMessage` can publish {@link RenderReady} / {@link RenderInvalidate} / `Error` to the message bus.
 */
export type RenderRequestedBusDeliveryFields = Pick<RenderRequested, 'componentId' | 'perspective' | 'characterId' | 'targets' | 'messageGroupId'>

export type RenderGenerationStarted = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderGenerationStarted';
}

/**
 * Terminal render orchestration failure on the render message bus (e.g. intake invariant, resolve failure).
 * Distinct from {@link RenderGenerationFailed}, which is scoped to the generation lifecycle.
 */
export type RenderError = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderError';
    errorCode: string;
    errorMessage: string;
}

/**
 * Build a {@link RenderError} bus message from a request payload, reusing correlation fields
 * (`componentId`, `perspective`, targets, etc.).
 */
export const toRenderError = (
    payload: RenderRequested,
    errorCode: string,
    errorMessage: string
): RenderError => ({
    type: 'RenderError',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    errorCode,
    errorMessage,
})

/**
 * Request that cached render hints for this component and perspective be cleared or treated stale
 * (e.g. Meta::Room `currentCacheByPerspective` entry).
 */
export type RenderInvalidate = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderInvalidate';
    /** Optional diagnostic; does not drive behavior in v1. */
    reason?: string;
}

/**
 * Build a {@link RenderInvalidate} bus message from a request payload, reusing correlation fields.
 */
export const toRenderInvalidate = (
    payload: RenderRequested,
    reason?: string
): RenderInvalidate => ({
    type: 'RenderInvalidate',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    ...(reason !== undefined ? { reason } : {}),
})

export type RenderReady = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderReady';
    cacheId: EphemeraCacheId;
    cacheRecord?: EphemeraCacheDynamoItem;
}

/**
 * Build a {@link RenderReady} bus message from a {@link RenderRequested} payload plus cache row fields.
 */
export const toRenderReady = (
    payload: RenderRequested,
    cacheId: EphemeraCacheId,
    cacheRecord: EphemeraCacheDynamoItem
): RenderReady => ({
    type: 'RenderReady',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    cacheId,
    cacheRecord,
})

export type RenderGenerationCompleted = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderGenerationCompleted';
    cacheId: EphemeraCacheId;
}

export type RenderGenerationFailed = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderGenerationFailed';
    errorCode: string;
    errorMessage: string;
}

/** Entry messages that start passive render work ({@link RenderRequested}). */
export type RenderOrchestrationRequestMessage = RenderRequested

export type RenderOrchestrationMessage =
    | RenderRequested
    | RenderError
    | RenderInvalidate
    | RenderGenerationStarted
    | RenderReady
    | RenderGenerationCompleted
    | RenderGenerationFailed

const isRenderComponentId = (value: unknown): value is RenderComponentId => (
    typeof value === 'string' && (isEphemeraRoomId(value) || isEphemeraFeatureId(value) || isEphemeraMapId(value))
)

const hasValidTargetContext = (value: Record<string, unknown>): boolean => {
    if (
        'characterId' in value
        && value.characterId !== undefined
        && (typeof value.characterId !== 'string' || !isEphemeraCharacterId(value.characterId))
    ) {
        return false
    }
    if (
        'targets' in value
        && value.targets !== undefined
        && (!Array.isArray(value.targets) || !value.targets.every((target) => (typeof target === 'string')))
    ) {
        return false
    }
    if ('messageGroupId' in value && value.messageGroupId !== undefined && typeof value.messageGroupId !== 'string') {
        return false
    }
    return true
}

export const isRenderRequested = (value: unknown): value is RenderRequested => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    if (castValue.type !== 'RenderRequested') {
        return false
    }
    if (!isRenderComponentId(castValue.componentId)) {
        return false
    }
    if (!isPerspective(castValue.perspective)) {
        return false
    }
    if ('allowGeneration' in castValue && castValue.allowGeneration !== undefined && typeof castValue.allowGeneration !== 'boolean') {
        return false
    }
    if ('generationContextWml' in castValue && castValue.generationContextWml !== undefined && typeof castValue.generationContextWml !== 'string') {
        return false
    }
    return hasValidTargetContext(castValue)
}

export const isRenderGenerationStarted = (value: unknown): value is RenderGenerationStarted => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    return (
        castValue.type === 'RenderGenerationStarted'
        && isRenderComponentId(castValue.componentId)
        && isPerspective(castValue.perspective)
        && hasValidTargetContext(castValue)
    )
}

export const isRenderError = (value: unknown): value is RenderError => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    if (castValue.type !== 'RenderError') {
        return false
    }
    if (!isRenderComponentId(castValue.componentId)) {
        return false
    }
    if (!isPerspective(castValue.perspective)) {
        return false
    }
    if (typeof castValue.errorCode !== 'string') {
        return false
    }
    if (typeof castValue.errorMessage !== 'string') {
        return false
    }
    return hasValidTargetContext(castValue)
}

export const isRenderInvalidate = (value: unknown): value is RenderInvalidate => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    if (castValue.type !== 'RenderInvalidate') {
        return false
    }
    if (!isRenderComponentId(castValue.componentId)) {
        return false
    }
    if (!isPerspective(castValue.perspective)) {
        return false
    }
    if ('reason' in castValue && castValue.reason !== undefined && typeof castValue.reason !== 'string') {
        return false
    }
    return hasValidTargetContext(castValue)
}

const isCacheId = (value: unknown): value is EphemeraCacheId => (
    typeof value === 'string' && value.startsWith('CACHE#')
)

export const isRenderReady = (value: unknown): value is RenderReady => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    if (
        castValue.type !== 'RenderReady'
        || !isRenderComponentId(castValue.componentId)
        || !isPerspective(castValue.perspective)
        || !isCacheId(castValue.cacheId)
    ) {
        return false
    }
    if ('cacheRecord' in castValue && castValue.cacheRecord !== undefined) {
        if (!castValue.cacheRecord || typeof castValue.cacheRecord !== 'object') {
            return false
        }
    }
    return hasValidTargetContext(castValue)
}

export const isRenderGenerationCompleted = (value: unknown): value is RenderGenerationCompleted => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    return (
        castValue.type === 'RenderGenerationCompleted'
        && isRenderComponentId(castValue.componentId)
        && isPerspective(castValue.perspective)
        && isCacheId(castValue.cacheId)
        && hasValidTargetContext(castValue)
    )
}

export const isRenderGenerationFailed = (value: unknown): value is RenderGenerationFailed => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    return (
        castValue.type === 'RenderGenerationFailed'
        && isRenderComponentId(castValue.componentId)
        && isPerspective(castValue.perspective)
        && typeof castValue.errorCode === 'string'
        && typeof castValue.errorMessage === 'string'
        && hasValidTargetContext(castValue)
    )
}

export const isRenderOrchestrationMessage = (value: unknown): value is RenderOrchestrationMessage => (
    isRenderRequested(value)
    || isRenderError(value)
    || isRenderInvalidate(value)
    || isRenderGenerationStarted(value)
    || isRenderReady(value)
    || isRenderGenerationCompleted(value)
    || isRenderGenerationFailed(value)
)

export const isRenderOrchestrationRequestMessage = (value: unknown): value is RenderOrchestrationRequestMessage => (
    isRenderRequested(value)
)
