import { Perspective, isPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { EphemeraFeatureId, EphemeraMapId, EphemeraRoomId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId, isEphemeraCharacterId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { MessageGroupId } from '../internalCache/orchestrateMessages'
import { PublishTarget } from '../messageBus/baseClasses'
import { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'

export type RenderComponentId = EphemeraRoomId | EphemeraFeatureId | EphemeraMapId

type RenderTargetContext = {
    characterId?: EphemeraCharacterId;
    targets?: PublishTarget[];
    messageGroupId?: MessageGroupId;
}

export type RenderRequested = RenderTargetContext & {
    type: 'RenderRequested';
    componentId: RenderComponentId;
    perspective: Perspective;
    allowGeneration?: boolean;
    generationContextWml?: string;
}

export type RenderGenerationStarted = RenderTargetContext & {
    type: 'RenderGenerationStarted';
    componentId: RenderComponentId;
    perspective: Perspective;
}

export type RenderLookupRequested = RenderTargetContext & {
    type: 'RenderLookupRequested';
    componentId: RenderComponentId;
    perspective: Perspective;
    allowGeneration?: boolean;
    generationContextWml?: string;
}

export type RenderReady = RenderTargetContext & {
    type: 'RenderReady';
    componentId: RenderComponentId;
    perspective: Perspective;
    cacheId: EphemeraCacheId;
    cacheRecord?: EphemeraCacheDynamoItem;
}

export type RenderGenerationCompleted = RenderTargetContext & {
    type: 'RenderGenerationCompleted';
    componentId: RenderComponentId;
    perspective: Perspective;
    cacheId: EphemeraCacheId;
}

export type RenderGenerationFailed = RenderTargetContext & {
    type: 'RenderGenerationFailed';
    componentId: RenderComponentId;
    perspective: Perspective;
    errorCode: string;
    errorMessage: string;
}

export type RenderOrchestrationMessage =
    | RenderRequested
    | RenderLookupRequested
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

export const isRenderLookupRequested = (value: unknown): value is RenderLookupRequested => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const castValue = value as Record<string, unknown>
    if (castValue.type !== 'RenderLookupRequested') {
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
    || isRenderLookupRequested(value)
    || isRenderGenerationStarted(value)
    || isRenderReady(value)
    || isRenderGenerationCompleted(value)
    || isRenderGenerationFailed(value)
)

