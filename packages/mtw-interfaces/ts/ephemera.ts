import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId, EphemeraMapId, EphemeraRoomId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraRoomId } from "./baseClasses"
import { LegalCharacterColor } from './baseClasses'
import { isMapDescribeData, isMessage, MapDescribeData, Message } from "./messages"
import { checkAll, checkTypes } from "./utils";

export type RegisterCharacterAPIMessage = {
    message: 'registercharacter';
    CharacterId: EphemeraCharacterId;
}

export type UnregisterCharacterAPIMessage = {
    message: 'unregistercharacter';
    CharacterId: EphemeraCharacterId;
}

export type FetchEphemeraAPIMessage = {
    message: 'fetchEphemera';
    CharacterId?: string;
}

export type WhoAmIAPIMessage = {
    message: 'whoAmI';
}

export type SyncAPIMessage = {
    message: 'sync';
    CharacterId: string;
    startingAt?: number;
    limit?: number;
}

export type MapSubscribeAPIMessage = {
    message: 'subscribeToMaps';
    CharacterId: string;
}

export type MapUnsubscribeAPIMessage = {
    message: 'unsubscribeFromMaps';
    CharacterId: string;
}

type ActionAPILookMessage = {
    actionType: 'look';
    payload: {
        CharacterId: EphemeraCharacterId;
        EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraMapId;
    }
}

type ActionAPICommunicationMetaMessage = {
    payload: {
        CharacterId: EphemeraCharacterId;
        Message: string;
    }
}

type ActionAPISayMessage = {
    actionType: 'SayMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPINarrateMessage = {
    actionType: 'NarrateMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPIOOCMessage = {
    actionType: 'OOCMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPIMoveMessage = {
    actionType: 'move';
    payload: {
        CharacterId: EphemeraCharacterId;
        RoomId: EphemeraRoomId;
        ExitName?: string;
    }
}

type ActionAPIHomeMessage = {
    actionType: 'home';
    payload: {
        CharacterId: EphemeraCharacterId;
    }
}

export type ActionAPIMessage = {
    message: 'action';
} & (
    ActionAPILookMessage |
    ActionAPISayMessage |
    ActionAPINarrateMessage |
    ActionAPIOOCMessage |
    ActionAPIMoveMessage |
    ActionAPIHomeMessage
)

export type LinkAPIMessage = {
    message: 'link';
    to: EphemeraFeatureId | EphemeraCharacterId | EphemeraKnowledgeId;
    CharacterId?: EphemeraCharacterId;
    directResponse?: boolean;
}

export type CommandAPIMessage = {
    message: 'command';
    CharacterId: EphemeraCharacterId;
    command: string;
}

export type EphemeraAPIMessage = { RequestId?: string } & (
    RegisterCharacterAPIMessage |
    UnregisterCharacterAPIMessage |
    FetchEphemeraAPIMessage |
    WhoAmIAPIMessage |
    SyncAPIMessage |
    MapSubscribeAPIMessage |
    MapUnsubscribeAPIMessage |
    ActionAPIMessage |
    LinkAPIMessage |
    CommandAPIMessage
)

export const isRegisterCharacterAPIMessage = (message: EphemeraAPIMessage): message is RegisterCharacterAPIMessage => (message.message === 'registercharacter')
export const isUnregisterCharacterAPIMessage = (message: EphemeraAPIMessage): message is UnregisterCharacterAPIMessage => (message.message === 'unregistercharacter')
export const isFetchEphemeraAPIMessage = (message: EphemeraAPIMessage): message is FetchEphemeraAPIMessage => (message.message === 'fetchEphemera')
export const isWhoAmIAPIMessage = (message: EphemeraAPIMessage): message is WhoAmIAPIMessage => (message.message === 'whoAmI')
export const isSyncAPIMessage = (message: EphemeraAPIMessage): message is SyncAPIMessage => (message.message === 'sync')
export const isMapSubscribeAPIMessage = (message: EphemeraAPIMessage): message is MapSubscribeAPIMessage => (message.message === 'subscribeToMaps')
export const isMapUnsubscribeAPIMessage = (message: EphemeraAPIMessage): message is MapUnsubscribeAPIMessage => (message.message === 'unsubscribeFromMaps')
export const isActionAPIMessage = (message: EphemeraAPIMessage): message is ActionAPIMessage => (message.message === 'action')
export const isLinkAPIMessage = (message: EphemeraAPIMessage): message is LinkAPIMessage => (message.message === 'link')
export const isCommandAPIMessage = (message: EphemeraAPIMessage): message is CommandAPIMessage => (message.message === 'command')

export const isEphemeraAPIMessage = (message: any): message is EphemeraAPIMessage => {
    if (typeof message !== 'object') {
        return false
    }
    if (!('message' in message)) {
        return false
    }
    switch(message.message) {
        case 'registercharacter':
        case 'unregistercharacter':
            return Boolean(
                checkTypes(message, { CharacterId: 'string' })
                && isEphemeraCharacterId(message.CharacterId)
            )
        case 'subscribeToMaps':
        case 'unsubscribeFromMaps':
        case 'fetchEphemera':
            return checkTypes(message, {}, { CharacterId: 'string' })
        case 'whoAmI':
            return true
        case 'sync':
            return Boolean(
                'CharacterId' in message
                && typeof message.CharacterId === 'string'
                /* && isEphemeraCharacterId(message.CharacterId)*/
                && (typeof (message.startingAt ?? 0) === 'number')
                && (typeof (message.limit ?? 0) === 'number')
            )
        case 'link':
            return Boolean(
                checkTypes(message, { to: 'string' }, { CharacterId: 'string' })
                && (!message.CharacterId || isEphemeraCharacterId(message.CharacterId))
                && (isEphemeraFeatureId(message.to) || isEphemeraCharacterId(message.to) || isEphemeraKnowledgeId(message.to))
            )
        case 'command':
            return Boolean(
                checkTypes(message, { CharacterId: 'string', command: 'string' })
                && isEphemeraCharacterId(message.CharacterId)
            )
        case 'action':
            if (!('actionType' in message && 'payload' in message && typeof message.payload === 'object')) {
                return false
            }
            switch(message.actionType) {
                case 'look':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                        && 'EphemeraId' in message.payload
                        && typeof message.payload.EphemeraId === 'string'
                        && (
                            isEphemeraRoomId(message.payload.EphemeraId)
                            || isEphemeraFeatureId(message.payload.EphemeraId)
                            || isEphemeraMapId(message.payload.EphemeraId)
                        )
                    )
                case 'SayMessage':
                case 'NarrateMessage':
                case 'OOCMessage':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                        && 'Message' in message.payload
                        && typeof message.payload.Message === 'string'
                    )
                case 'move':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                        && 'RoomId' in message.payload
                        && typeof message.payload.RoomId === 'string'
                        && isEphemeraRoomId(message.payload.RoomId)
                        && (typeof (message.payload.ExitName || 'default') === 'string')
                    )
                case 'home':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                    )
                default: return false
            }
        default: return false
    }
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive = {
    type: 'CharacterInPlay';
    CharacterId: EphemeraCharacterId;
    Connected: false;
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlayActive = {
    type: 'CharacterInPlay';
    CharacterId: EphemeraCharacterId;
    Connected: true;
    RoomId: EphemeraRoomId;
    DisplayName: string;
    fileURL?: string;
    Color: LegalCharacterColor;
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlay = EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive | EphemeraClientMessageEphemeraUpdateCharacterInPlayActive

export const isEphemeraClientMessageEphemeraUpdateCharacterInPlay = (message: any): message is EphemeraClientMessageEphemeraUpdateCharacterInPlay => {
    if (typeof message === 'object' && 'type' in message && message.type === 'CharacterInPlay') {
        if ('Connected' in message && typeof message.Connected === 'boolean') {
            if (!message.Connected) {
                return true
            }
            if (!('CharacterId' in message && typeof message.CharacterId === 'string' && isEphemeraCharacterId(message.CharacterId))) {
                return false
            }
            if (!('RoomId' in message && typeof message.RoomId === 'string' && isEphemeraRoomId(message.RoomId))) {
                return false
            }
            if (!('DisplayName' in message && typeof message.DisplayName === 'string')) {
                return false
            }
            if ('fileURL' in message && !(typeof message.fileURL === 'string')) {
                return false
            }
            return ['blue', 'pink', 'purple', 'green', 'grey'].includes(message.Color)
        }
    }
    return false
}

export type EphemeraClientMessageEphemeraUpdateMapItemInactive = {
    type: 'MapUpdate';
    targets: EphemeraCharacterId[];
    MapId: EphemeraMapId;
    active: false;
}

export type EphemeraClientMessageEphemeraUpdateMapItemActive = {
    type: 'MapUpdate';
    targets: EphemeraCharacterId[];
    active: true;
    description: string;
    MapId: EphemeraMapId;
}

export type EphemeraClientMessageEphemeraUpdateMapClear = {
    type: 'MapClear';
    targets: EphemeraCharacterId[];
    MapId?: EphemeraMapId;
}

export type EphemeraClientMessageEphemeraUpdateMapItem = EphemeraClientMessageEphemeraUpdateMapItemInactive | EphemeraClientMessageEphemeraUpdateMapItemActive

export const isEphemeraClientMessageEphemeraUpdateMapItem = (message: any): message is EphemeraClientMessageEphemeraUpdateMapItem => {
    if (
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'MapUpdate' &&
        'active' in message &&
        typeof message.active === 'boolean'
    ) {
        if (!message.active) {
            return true
        }
        if (!('MapId' in message && typeof message.MapId === 'string' && isEphemeraMapId(message.MapId))) {
            return false
        }
        return Boolean('description' in message && typeof message.description === 'string')
    }
    return false
}

export const isEphemeraClientMessageephemeraUpdateMapClear = (message: any): message is EphemeraClientMessageEphemeraUpdateMapItem => {
    if (
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'MapClear'
    ) {
        if (!Array.isArray(message.targets)) {
            return false
        }
        return checkAll(...(message.targets.map((target: any) => (typeof target === 'string' && isEphemeraCharacterId(target)))))
    }
    return false
}

export type EphemeraClientMessageEphemeraUpdateItem = EphemeraClientMessageEphemeraUpdateCharacterInPlay | EphemeraClientMessageEphemeraUpdateMapItem  | EphemeraClientMessageEphemeraUpdateMapClear

export type EphemeraClientMessageEphemeraUpdate = {
    messageType: 'Ephemera';
    RequestId?: string;
    updates: EphemeraClientMessageEphemeraUpdateItem[];
}

export type EphemeraClientMessagePublishMessages = {
    messageType: 'Messages';
    RequestId?: string;
    LastSync?: number;
    messages: Message[];
}

export type EphemeraClientMessageRegisterMessage = {
    messageType: 'Registration';
    RequestId?: string;
    CharacterId: string;
}

export type EphemeraClientMessageUnregisterMessage = {
    messageType: 'Unegistration';
    RequestId?: string;
    CharacterId: string;
}

export type EphemeraClientMessageSubscribeToMapsMessage = {
    messageType: 'SubscribeToMaps';
    RequestId?: string;
}

export type EphemeraClientMessageUnsubscribeFromMapsMessage = {
    messageType: 'UnsubscribeFromMaps';
    RequestId?: string;
}

/** Step within a `messageType: 'ConversationStep'` pipeline (e.g. preview progress vs completion). */
export type ConversationStepKind = 'generating' | 'complete' | 'error'

export type GenerateRoomPreviewBody = {
    success: boolean;
    renderedContent?: unknown;
    errorCode?: string;
    errorMessage?: string;
}

/** Preview pipelines on the wire (extend with more literals as new flows ship). */
export type ConversationStepPipeline = 'generateRoomPreview'

/**
 * Shared envelope for `pipeline: 'generateRoomPreview'` conversation steps.
 * Step-specific fields are on the discriminated union {@link EphemeraClientMessageConversationStepGenerateRoomPreview}.
 */
export type EphemeraClientMessageConversationStepGenerateRoomPreviewCommon = {
    messageType: 'ConversationStep';
    RequestId?: string;
    conversationId: string;
    pipeline: 'generateRoomPreview';
}

export type EphemeraClientMessageConversationStepGenerateRoomPreview =
    | (EphemeraClientMessageConversationStepGenerateRoomPreviewCommon & { step: 'generating' })
    | (EphemeraClientMessageConversationStepGenerateRoomPreviewCommon & {
        step: 'complete';
        generateRoomPreview: GenerateRoomPreviewBody;
    })
    | (EphemeraClientMessageConversationStepGenerateRoomPreviewCommon & {
        step: 'error';
        generateRoomPreview: GenerateRoomPreviewBody;
    })

export type EphemeraClientMessageConversationStep = EphemeraClientMessageConversationStepGenerateRoomPreview

export type EphemeraClientMessageConversationStepGenerateRoomPreviewGenerating = Extract<
    EphemeraClientMessageConversationStepGenerateRoomPreview,
    { step: 'generating' }
>
export type EphemeraClientMessageConversationStepGenerateRoomPreviewComplete = Extract<
    EphemeraClientMessageConversationStepGenerateRoomPreview,
    { step: 'complete' }
>
export type EphemeraClientMessageConversationStepGenerateRoomPreviewError = Extract<
    EphemeraClientMessageConversationStepGenerateRoomPreview,
    { step: 'error' }
>

/**
 * Legacy single-response preview (completion only, no `conversationId`).
 * Prefer `messageType: 'ConversationStep'` for anything correlated with `conversationId`.
 */
export type EphemeraClientMessageGenerateRoomPreview = {
    messageType: 'GenerateRoomPreview';
    RequestId?: string;
    generateRoomPreview: GenerateRoomPreviewBody;
}

const isValidGenerateRoomPreviewBody = (generateRoomPreview: any): boolean => {
    if (!generateRoomPreview || typeof generateRoomPreview !== 'object') {
        return false
    }
    if (!('success' in generateRoomPreview) || typeof generateRoomPreview.success !== 'boolean') {
        return false
    }
    if (!generateRoomPreview.success) {
        if (!('errorMessage' in generateRoomPreview) || typeof generateRoomPreview.errorMessage !== 'string') {
            return false
        }
        if ('errorCode' in generateRoomPreview && typeof generateRoomPreview.errorCode !== 'string') {
            return false
        }
    }
    return true
}

export const isEphemeraClientMessageGenerateRoomPreview = (message: any): message is EphemeraClientMessageGenerateRoomPreview => {
    if (!checkTypes(message, { messageType: 'string' }, { RequestId: 'string' })) {
        return false
    }
    if (message.messageType !== 'GenerateRoomPreview') {
        return false
    }
    if ('conversationId' in message || 'conversationStep' in message || 'pipeline' in message || 'step' in message) {
        return false
    }
    if (!('generateRoomPreview' in message)) {
        return false
    }
    return isValidGenerateRoomPreviewBody(message.generateRoomPreview)
}

export const isEphemeraClientMessageConversationStep = (message: any): message is EphemeraClientMessageConversationStep => {
    if (!checkTypes(message, { messageType: 'string' }, { RequestId: 'string' })) {
        return false
    }
    if (message.messageType !== 'ConversationStep') {
        return false
    }
    if (typeof message.conversationId !== 'string' || message.conversationId.length === 0) {
        return false
    }
    if (message.pipeline !== 'generateRoomPreview') {
        return false
    }
    const step = message.step as ConversationStepKind | undefined
    if (step === 'generating') {
        if ('generateRoomPreview' in message && message.generateRoomPreview !== undefined) {
            return false
        }
        return true
    }
    if (step === 'complete' || step === 'error') {
        if (!('generateRoomPreview' in message)) {
            return false
        }
        return isValidGenerateRoomPreviewBody(message.generateRoomPreview)
    }
    return false
}

/** Narrows to `ConversationStep` messages for the generateRoomPreview pipeline (any step). */
export const isConversationStepGenerateRoomPreview = (
    message: unknown
): message is EphemeraClientMessageConversationStepGenerateRoomPreview => {
    return isEphemeraClientMessageConversationStep(message)
}

/** @deprecated Use {@link isConversationStepGenerateRoomPreview}. */
export const isGenerateRoomPreviewConversationStep = isConversationStepGenerateRoomPreview

export const isConversationCorrelatedPayload = (
    payload: unknown
): payload is { conversationId: string; RequestId?: string } & Record<string, unknown> => {
    if (!payload || typeof payload !== 'object') {
        return false
    }
    const p = payload as Record<string, unknown>
    return typeof p.conversationId === 'string' && p.conversationId.length > 0
}

/**
 * Whether a LifeLine / Ephemera inbound payload should end a `socketDispatchConversation` stream
 * by default (Error, terminal `ConversationStep`, or legacy one-shot GenerateRoomPreview).
 */
export const isTerminalConversationStep = (payload: unknown): boolean => {
    if (!payload || typeof payload !== 'object') {
        return false
    }
    const p = payload as Record<string, unknown>
    if (p.messageType === 'Error') {
        return true
    }
    if (p.messageType === 'ConversationStep') {
        if (p.step === 'generating') {
            return false
        }
        if (p.step === 'complete' || p.step === 'error') {
            return isEphemeraClientMessageConversationStep(payload)
        }
        return false
    }
    if (p.messageType === 'GenerateRoomPreview') {
        return isEphemeraClientMessageGenerateRoomPreview(payload)
    }
    return false
}

export type EphemeraClientMessage = EphemeraClientMessageEphemeraUpdate |
    EphemeraClientMessagePublishMessages |
    EphemeraClientMessageRegisterMessage |
    EphemeraClientMessageUnregisterMessage |
    EphemeraClientMessageSubscribeToMapsMessage |
    EphemeraClientMessageUnsubscribeFromMapsMessage |
    EphemeraClientMessageConversationStep |
    EphemeraClientMessageGenerateRoomPreview

export const isEphemeraClientMessage = (message: any): message is EphemeraClientMessage => {
    if (!('messageType' in message && typeof message.messageType === 'string')) {
        return false
    }
    switch(message.messageType) {
        case 'Registration':
        case 'Unregistration':
            return checkTypes(message, { CharacterId: 'string' }, { RequestId: 'string' })            
        case 'SubscribeToMaps':
        case 'UnsubscribeFromMaps':
            return checkTypes(message, {}, { RequestId: 'string' })
        case 'Ephemera':
            if (!('updates' in message)) {
                return false
            }
            const updates = message.updates
            if (!Array.isArray(updates)) {
                return false
            }
            return updates.reduce<boolean>((previous, update) => {
                return previous && (
                    isEphemeraClientMessageEphemeraUpdateCharacterInPlay(update) 
                    || isEphemeraClientMessageEphemeraUpdateMapItem(update)
                    || isEphemeraClientMessageephemeraUpdateMapClear(update)
                )
            }, true)
        case 'Messages':
            if (!('messages' in message)) {
                return false
            }
            if ('LastSync' in message && typeof message.LastSync !== 'number' && message.LastSync !== null) {
                return false
            }
            const messages = message.messages
            if (!Array.isArray(messages)) {
                return false
            }
            return messages.reduce<boolean>((previous, subMessage) => (
                previous && isMessage(subMessage)
            ), true)
        case 'ConversationStep':
            return isEphemeraClientMessageConversationStep(message)
        case 'GenerateRoomPreview':
            return isEphemeraClientMessageGenerateRoomPreview(message)
        default: return false
    }
}