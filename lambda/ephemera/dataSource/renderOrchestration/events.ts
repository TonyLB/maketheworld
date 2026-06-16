import { Perspective, isPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { isEphemeraCharacterId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { MessageGroupId } from '../../internalCache/orchestrateMessages'
import type {
    PublishTarget,
    RenderComponentId,
    RenderError,
    RenderGenerationCompleted,
    RenderGenerationFailed,
    RenderGenerationStarted,
    RenderInvalidate,
    RenderOrchestrationMessage,
    RenderOrchestrationRequestMessage,
    RenderReady,
    RenderRequested,
} from '../../messageBus/baseClasses'
import { isRenderComponentId } from '../../messageBus/baseClasses'
import { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'

type RenderTargetContext = {
    characterId?: EphemeraCharacterId;
    targets?: PublishTarget[];
    messageGroupId?: MessageGroupId;
}

/**
 * Which ephemera component and asset-stack perspective a render message refers to.
 * Present on essentially all {@link RenderOrchestrationMessage} variants.
 */

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
export type RenderComponentPerspective = {
    componentId: RenderComponentId;
    perspective: Perspective;
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
