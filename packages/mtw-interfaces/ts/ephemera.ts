import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId, EphemeraMapId, EphemeraRoomId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraRoomId } from "./baseClasses"
import { LegalCharacterColor } from './baseClasses'
import { isEphemeraCacheMarkState, type EphemeraCacheMarkState } from "./ephemeraMeta"
import { isThinkingResultEvent, type ThinkingResultEvent } from "./eventBridge/ephemera/thinking"
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

/**
 * WebSocket client requests that map to internal `api.ephemera` StreamingEvents (see lambda ephemera `send*` helpers).
 */
export type EphemeraApiStateChangeRequest = {
    message: 'ephemeraStateChange';
    componentId: string;
    markState: EphemeraCacheMarkState;
}

/** Fetch one persisted thinking result by {@link ThinkingResultEvent.workItemId}. */
export type FetchThinkingResultAPIMessage = {
    message: 'fetchThinkingResult';
    workItemId: string;
}

/** Correlates {@link EphemeraClientMessageEphemeraCommandSuccess} with the originating request. */
export type EphemeraApiCommand = 'stateChange'

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
    CommandAPIMessage |
    EphemeraApiStateChangeRequest |
    FetchThinkingResultAPIMessage
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

const isEphemeraApiStateChangeWire = (message: any): boolean => {
    if (!message || typeof message !== 'object') {
        return false
    }
    if (message.message !== 'ephemeraStateChange') {
        return false
    }
    if (typeof message.componentId !== 'string') {
        return false
    }
    if (!isEphemeraCacheMarkState(message.markState)) {
        return false
    }
    if (message.RequestId !== undefined && typeof message.RequestId !== 'string') {
        return false
    }
    return true
}

export const isEphemeraApiStateChangeAPIMessage = (message: EphemeraAPIMessage): message is EphemeraApiStateChangeRequest => (
    message.message === 'ephemeraStateChange'
)

export const isFetchThinkingResultAPIMessage = (message: EphemeraAPIMessage): message is FetchThinkingResultAPIMessage => (
    message.message === 'fetchThinkingResult'
)

const isFetchThinkingResultWire = (message: any): boolean => {
    if (!message || typeof message !== 'object') {
        return false
    }
    if (message.message !== 'fetchThinkingResult') {
        return false
    }
    if (typeof message.workItemId !== 'string' || message.workItemId.length === 0) {
        return false
    }
    if (message.RequestId !== undefined && typeof message.RequestId !== 'string') {
        return false
    }
    return true
}

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
        case 'ephemeraStateChange':
            return isEphemeraApiStateChangeWire(message)
        case 'fetchThinkingResult':
            return isFetchThinkingResultWire(message)
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

/** Correlated success ack for {@link EphemeraApiStateChangeRequest}. */
export type EphemeraClientMessageEphemeraCommandSuccess = {
    messageType: 'EphemeraCommandSuccess';
    RequestId?: string;
    command: EphemeraApiCommand;
    componentId: string;
}

/** Correlated error ack (matches map subscription and `socketDispatchPromise` rejection). */
export type EphemeraClientMessageError = {
    messageType: 'Error';
    RequestId?: string;
    message: string;
    error?: string;
}

/** Correlated success for {@link FetchThinkingResultAPIMessage}. */
export type EphemeraClientMessageThinkingResult = {
    messageType: 'ThinkingResult';
    RequestId?: string;
    result: ThinkingResultEvent;
}

/**
 * Correlated server-to-client streams use `messageType: 'ConversationStep'` (LifeLine
 * {@link isTerminalConversationStep} / client `socketDispatchConversation`). Preview-only
 * wire shapes were removed; this envelope stays as the extension point. Add a new feature by:
 * (1) documenting a non-empty `pipeline` string (and optionally a string-literal union type);
 * (2) defining pipeline-specific payload types and narrowing helpers next to this base type;
 * (3) extending {@link isEphemeraClientMessageConversationStep} if stricter validation is needed.
 * See `AGENT.md` in this package (Ephemera client messages, ConversationStep).
 */
/** Lifecycle step within a `messageType: 'ConversationStep'` message. */
export type ConversationStepKind = 'generating' | 'complete' | 'error'

/**
 * Pipeline name (non-empty string on the wire). Narrow with string literal unions per feature.
 */
export type ConversationStepPipeline = string

type EphemeraClientMessageConversationStepBase = {
    messageType: 'ConversationStep';
    RequestId?: string;
    conversationId: string;
    pipeline: ConversationStepPipeline;
}

export type EphemeraClientMessageConversationStep =
    | (EphemeraClientMessageConversationStepBase & { step: 'generating' })
    | (EphemeraClientMessageConversationStepBase & { step: 'complete'; payload?: unknown })
    | (EphemeraClientMessageConversationStepBase & { step: 'error'; payload?: unknown })

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
    if (typeof message.pipeline !== 'string' || message.pipeline.length === 0) {
        return false
    }
    const step = message.step as ConversationStepKind | undefined
    if (step !== 'generating' && step !== 'complete' && step !== 'error') {
        return false
    }
    if ('generateRoomPreview' in message) {
        return false
    }
    return true
}

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
 * by default: `Error`, or terminal `ConversationStep` (`complete` / `error` with a valid envelope).
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
    return false
}

export type EphemeraClientMessage = EphemeraClientMessageEphemeraUpdate |
    EphemeraClientMessagePublishMessages |
    EphemeraClientMessageRegisterMessage |
    EphemeraClientMessageUnregisterMessage |
    EphemeraClientMessageSubscribeToMapsMessage |
    EphemeraClientMessageUnsubscribeFromMapsMessage |
    EphemeraClientMessageEphemeraCommandSuccess |
    EphemeraClientMessageError |
    EphemeraClientMessageThinkingResult |
    EphemeraClientMessageConversationStep

export const isEphemeraClientMessageEphemeraCommandSuccess = (message: any): message is EphemeraClientMessageEphemeraCommandSuccess => {
    if (!message || typeof message !== 'object') {
        return false
    }
    if (message.messageType !== 'EphemeraCommandSuccess') {
        return false
    }
    if (!checkTypes(message, { command: 'string', componentId: 'string' }, { RequestId: 'string' })) {
        return false
    }
    return message.command === 'stateChange'
}

export const isEphemeraClientMessageError = (message: any): message is EphemeraClientMessageError => {
    if (!message || typeof message !== 'object') {
        return false
    }
    if (message.messageType !== 'Error') {
        return false
    }
    if (typeof message.message !== 'string') {
        return false
    }
    if (message.RequestId !== undefined && typeof message.RequestId !== 'string') {
        return false
    }
    if (message.error !== undefined && typeof message.error !== 'string') {
        return false
    }
    return true
}

export const isEphemeraClientMessageThinkingResult = (message: any): message is EphemeraClientMessageThinkingResult => {
    if (!message || typeof message !== 'object') {
        return false
    }
    if (message.messageType !== 'ThinkingResult') {
        return false
    }
    if (message.RequestId !== undefined && typeof message.RequestId !== 'string') {
        return false
    }
    return isThinkingResultEvent(message.result)
}

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
        case 'EphemeraCommandSuccess':
            return isEphemeraClientMessageEphemeraCommandSuccess(message)
        case 'Error':
            return isEphemeraClientMessageError(message)
        case 'ThinkingResult':
            return isEphemeraClientMessageThinkingResult(message)
        default: return false
    }
}