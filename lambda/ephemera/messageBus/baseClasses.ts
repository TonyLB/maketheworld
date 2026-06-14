import {
    InternalMessageBus,
    type ReturnValueMessage,
    type ErrorMessage,
    isReturnValueMessage,
    isErrorMessage,
} from '@tonylb/mtw-lambda-patterns/ts/messageBus'

export type { ReturnValueMessage, ErrorMessage }
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'

import { LegalCharacterColor, isEphemeraTaggedId, isEphemeraRoomId, isEphemeraFeatureId, isEphemeraCharacterId, EphemeraAssetId, EphemeraKnowledgeId, isEphemeraKnowledgeId, isEphemeraAssetId, } from "@tonylb/mtw-interfaces/ts/baseClasses"
import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraMapId,
    EphemeraRoomId,
    isEphemeraMapId
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { EphemeraClientMessageEphemeraUpdateCharacterInPlayActive, EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive, EphemeraClientMessageEphemeraUpdateMapClear, EphemeraClientMessageEphemeraUpdateMapItem } from "@tonylb/mtw-interfaces/ts/ephemera"

import { MessageGroupId } from "../internalCache/orchestrateMessages"
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'

export type PublishTargetRoom = `ROOM#${string}`

export type PublishTargetCharacter = `CHARACTER#${string}`
export type PublishTargetExcludeCharacter = `!CHARACTER#${string}`

export type PublishTargetSession = `SESSION#${string}`
export type PublishTargetExcludeSession = `!SESSION#${string}`

export type PublishTargetGlobal = `GLOBAL`

export type PublishTarget = PublishTargetRoom | PublishTargetCharacter | PublishTargetExcludeCharacter | PublishTargetSession | PublishTargetExcludeSession | PublishTargetGlobal

export const isPublishTargetRoom = isEphemeraTaggedId<'ROOM'>('ROOM')
export const isPublishTargetCharacter = isEphemeraTaggedId<'CHARACTER'>('CHARACTER')
export const isPublishTargetExcludeCharacter = isEphemeraTaggedId<'!CHARACTER'>('!CHARACTER')
export const isPublishTargetSession = isEphemeraTaggedId<'SESSION'>('SESSION')
export const isPublishTargetExcludeSession = isEphemeraTaggedId<'!SESSION'>('!SESSION')
export const isPublishTargetGlobal = (key: string): key is PublishTargetGlobal => (key === 'GLOBAL')

export const isPublishTarget = (key: string): key is PublishTarget => (
    isPublishTargetRoom(key)
    || isPublishTargetCharacter(key)
    || isPublishTargetExcludeCharacter(key)
    || isPublishTargetSession(key)
    || isPublishTargetExcludeSession(key)
    || isPublishTargetGlobal(key)
)

export const isNonEmptyPublishTargetArray = (value: unknown): value is PublishTarget[] => (
    Array.isArray(value)
    && value.length > 0
    && value.every((t) => typeof t === 'string' && isPublishTarget(t))
)

export type PublishMessageBase = {
    type: 'PublishMessage';
    targets: PublishTarget[];
    messageGroupId?: MessageGroupId;
    /** Websocket egress timing. Default `immediate`. */
    deliveryMode?: 'immediate' | 'deferred';
}

export type PublishWorldMessage = PublishMessageBase & {
    displayProtocol: 'WorldMessage';
    message: RenderTree;
    /** When set, publishMessage uses this RowId so a later terminal message overwrites the same client row. */
    messageId?: string;
    /** When set, overrides default CreatedTime ordering for this payload. */
    createdTime?: number;
}

export type PublishWorldOOCMessage = PublishMessageBase & {
    displayProtocol: 'WorldOOCMessage';
    message: RenderTree;
    messageId?: string;
    createdTime?: number;
}

export type PublishCommandTranscriptMessage = PublishMessageBase & {
    displayProtocol: 'CommandTranscriptMessage';
    message: RenderTree;
    messageId?: string;
    createdTime?: number;
}

export type PublishCoyoteGameHelpMessage = PublishMessageBase & {
    displayProtocol: 'CoyoteGameHelpMessage';
    messageId?: string;
    createdTime?: number;
}

export type PublishCoyoteGameHypothesisMessage = PublishMessageBase & {
    displayProtocol: 'CoyoteGameHypothesisMessage';
    message: RenderTree;
    messageId?: string;
    createdTime?: number;
}

type MessageCharacterInfo = {
    characterId: EphemeraCharacterId;
    name: string;
    color: LegalCharacterColor;
}

export type PublishSpeechMessage = PublishMessageBase & MessageCharacterInfo & {
    displayProtocol: 'SayMessage';
    message: RenderTree;
}

export type PublishNarrateMessage = PublishMessageBase & MessageCharacterInfo & {
    displayProtocol: 'NarrateMessage';
    message: RenderTree;
}

export type PublishOutOfCharacterMessage = {
    displayProtocol: 'OOCMessage';
    message: RenderTree;
} & PublishMessageBase & MessageCharacterInfo

/**
 * Room **`PerceptionMessage`** rows (wire / bus): **`displayProtocol: 'PerceptionMessage'`** with **`metaData`** from **`@tonylb/mtw-interfaces`**.
 * For **`ROOM#...`** metadata, **`metaData.roomChannel`** (`'render' | 'affordances'`, omitted = treat as **`render`**) discriminates **room-render** vs **room-affordances**; see **`lambda/ephemera/AGENT.multiChannel.contract.md`**.
 * Emitters setting **`roomChannel`** on publishes are **Phase B**; this type already carries the field when present on **`PerceptionRoomMetaData`**.
 */
export type PublishPerceptionMessage = {
    displayProtocol: 'PerceptionMessage';
    wmlContent: string;
    metaData: import('@tonylb/mtw-interfaces/ts/messages').PerceptionMessageMetaData;
    /** When set, publishMessage uses this RowId so a later terminal message overwrites the same client row. */
    messageId?: string;
    /** When set, overrides default CreatedTime ordering for this payload. */
    createdTime?: number;
} & PublishMessageBase

export type PublishMessage = PublishWorldMessage |
    PublishWorldOOCMessage |
    PublishCommandTranscriptMessage |
    PublishCoyoteGameHelpMessage |
    PublishCoyoteGameHypothesisMessage |
    PublishSpeechMessage |
    PublishNarrateMessage |
    PublishOutOfCharacterMessage |
    PublishPerceptionMessage

export type RegisterCharacterMessage = {
    type: 'RegisterCharacter';
    characterId: EphemeraCharacterId;
}

export type EphemeraPublishTarget = PublishTargetCharacter | PublishTargetGlobal | PublishTargetExcludeCharacter | PublishTargetSession | PublishTargetExcludeSession

export type EphemeraPartialCharacterInPlayActive = Pick<EphemeraClientMessageEphemeraUpdateCharacterInPlayActive, 'type' | 'CharacterId' | 'Connected'> & Partial<Omit<EphemeraClientMessageEphemeraUpdateCharacterInPlayActive, 'type' | 'CharacterId' | 'Connected'>>

export type EphemeraUpdateArgument = EphemeraClientMessageEphemeraUpdateMapItem  | EphemeraClientMessageEphemeraUpdateMapClear | EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive | EphemeraPartialCharacterInPlayActive

export const isEphemeraCharacterArgument = (value: EphemeraUpdateArgument): value is EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive | EphemeraPartialCharacterInPlayActive => (value.type === 'CharacterInPlay')

export type EphemeraUpdateMessage = {
    type: 'EphemeraUpdate';
    updates: (EphemeraUpdateArgument & { connectionTargets: EphemeraPublishTarget[] })[];
}

export type FetchPlayerEphemeraMessage = {
    type: 'FetchPlayerEphemera';
}

export type MapSubscriptionMessage = {
    type: 'SubscribeToMaps';
    characterId: EphemeraCharacterId;
}

export type MapUnsubscribeMessage = {
    type: 'UnsubscribeFromMaps';
    characterId: EphemeraCharacterId;
}

export type ImportDefaultsMessage = {
    type: 'ImportDefaults';
    components: Record<string, any>;
    aggregateExits: any[];
}

export type FetchImportDefaultsMessage = {
    type: 'FetchImportDefaults';
    importsByAssetId: Record<string, any>;
    assetId: string;
}

type PerceptionBase = {
    type: 'Perception';
    messageGroupId?: MessageGroupId;
}

export type PerceptionAssetMessage = {
    characterId?: EphemeraCharacterId;
    ephemeraId: EphemeraAssetId;
} & PerceptionBase

export type PerceptionRoomMessage = {
    characterId?: EphemeraCharacterId;
    ephemeraId: EphemeraRoomId;
    header?: boolean;
} & PerceptionBase

export type PerceptionComponentMessage = {
    characterId?: EphemeraCharacterId;
    ephemeraId: EphemeraFeatureId | EphemeraCharacterId | EphemeraKnowledgeId;
    directResponse?: boolean;
} & PerceptionBase

export type PerceptionMapMessage = {
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraMapId;
    mustIncludeRoomId?: EphemeraRoomId;
} & PerceptionBase

export type PerceptionMessage = PerceptionAssetMessage | PerceptionRoomMessage | PerceptionComponentMessage | PerceptionMapMessage

export const isPerceptionAssetMessage = (message: PerceptionMessage): message is PerceptionAssetMessage => (isEphemeraAssetId(message.ephemeraId))
export const isPerceptionRoomMessage = (message: PerceptionMessage): message is PerceptionRoomMessage => (isEphemeraRoomId(message.ephemeraId))
export const isPerceptionComponentMessage = (message: PerceptionMessage): message is PerceptionComponentMessage => (isEphemeraFeatureId(message.ephemeraId) || isEphemeraCharacterId(message.ephemeraId) || isEphemeraKnowledgeId(message.ephemeraId))
export const isPerceptionMapMessage = (message: PerceptionMessage): message is PerceptionMapMessage => (isEphemeraMapId(message.ephemeraId))

export type MoveCharacterMessage = {
    type: 'MoveCharacter';
    characterId: EphemeraCharacterId;
    roomId: EphemeraRoomId;
    suppressArrival?: boolean;
    arriveMessage?: string;
    suppressDeparture?: boolean;
    leaveMessage?: string;
    suppressSelfMessage?: boolean;
}

export type CheckLocationMessageInvariantPayload = {
    type: 'CheckLocation';
    forceMove?: boolean;
    forceRender?: boolean;
    suppressArrival?: boolean;
    arriveMessage?: string;
    suppressDeparture?: boolean;
    leaveMessage?: string;
}

export type CheckLocationPlayerMessage = CheckLocationMessageInvariantPayload & {
    characterId: EphemeraCharacterId;
}

export type CheckLocationRoomMessage = CheckLocationMessageInvariantPayload & {
    roomId: EphemeraRoomId
}

export type CheckLocationAssetMessage = CheckLocationMessageInvariantPayload & {
    assetId: EphemeraAssetId
}

export type CheckLocationMessage = CheckLocationPlayerMessage | CheckLocationRoomMessage | CheckLocationAssetMessage

export type CharacterEventMessage = {
    type: 'CharacterEvent';
}

export type RoomUpdateMessage = {
    type: 'RoomUpdate';
    roomId: EphemeraRoomId;
    render?: boolean;
}

export type LegalDependencyTag = 'Asset' | 'Room' | 'Feature' | 'Map'
export const isLegalDependencyTag = (tag: string): tag is LegalDependencyTag => (['Asset', 'Room', 'Feature', 'Map'].includes(tag))



export type MapUpdateMessage = {
    type: 'MapUpdate';
    characterId?: EphemeraCharacterId;
    sessionId?: string;
    roomId?: EphemeraRoomId;
    previousRoomId?: EphemeraRoomId;
    mapId?: EphemeraMapId;
}

export type CanonSetMessage = {
    type: 'CanonSet';
    assetIds: EphemeraAssetId[];
}

export type CanonAddRemoveMessage = {
    type: 'CanonAdd' | 'CanonRemove';
    assetId: EphemeraAssetId;
}

export type CanonUpdateMessage = CanonAddRemoveMessage | CanonSetMessage

export type ExecuteActionMessage = {
    type: 'ExecuteAction';
    action: import('@tonylb/mtw-interfaces/ts/ephemera').ActionAPIMessage;
}

export type RenderComponentId = EphemeraRoomId | EphemeraFeatureId | EphemeraMapId

type RenderTargetContext = {
    characterId?: EphemeraCharacterId;
    targets?: PublishTarget[];
    messageGroupId?: MessageGroupId;
}

export type RenderComponentPerspective = {
    componentId: RenderComponentId;
    perspective: Perspective;
}

export type RenderRequested = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderRequested';
    allowGeneration?: boolean;
    generationContextWml?: string;
}

export type RenderRequestedBusDeliveryFields = Pick<
    RenderRequested,
    'componentId' | 'perspective' | 'characterId' | 'targets' | 'messageGroupId'
>

export type RenderGenerationStarted = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderGenerationStarted';
}

export type RenderError = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderError';
    errorCode: string;
    errorMessage: string;
}

export type RenderInvalidate = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderInvalidate';
    reason?: string;
}

export type RenderReady = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderReady';
    cacheId: EphemeraCacheId;
    cacheRecord?: EphemeraCacheDynamoItem;
}

export type RenderGenerationCompleted = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderGenerationCompleted';
    cacheId: EphemeraCacheId;
}

export type RenderGenerationFailed = RenderTargetContext & RenderComponentPerspective & {
    type: 'RenderGenerationFailed';
    errorCode: string;
    errorMessage: string;
}

export type RenderOrchestrationRequestMessage = RenderRequested

export type RenderOrchestrationMessage =
    | RenderRequested
    | RenderError
    | RenderInvalidate
    | RenderGenerationStarted
    | RenderReady
    | RenderGenerationCompleted
    | RenderGenerationFailed

export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    header: StreamingEventHeader;
    timestamp: number;
    getContent: (format?: 'internal' | 'external') => Promise<unknown>;
}

export type MessageType = PublishMessage |
    ReturnValueMessage |
    ErrorMessage |
    RegisterCharacterMessage |
    EphemeraUpdateMessage |
    FetchPlayerEphemeraMessage |
    MapSubscriptionMessage |
    MapUnsubscribeMessage |
    ImportDefaultsMessage |
    FetchImportDefaultsMessage |
    PerceptionMessage |
    MoveCharacterMessage |
    CheckLocationMessage |
    CharacterEventMessage |
    RoomUpdateMessage |
    MapUpdateMessage |
    CanonUpdateMessage |
    ExecuteActionMessage |
    StreamingEventMessage |
    RenderOrchestrationMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')
export const isPublishWorldLineMessage = (prop: PublishMessage): prop is PublishWorldMessage | PublishWorldOOCMessage =>
    prop.displayProtocol === 'WorldMessage' || prop.displayProtocol === 'WorldOOCMessage'
export const isPublishCoyoteGameHelpMessage = (prop: PublishMessage): prop is PublishCoyoteGameHelpMessage => (prop.displayProtocol === 'CoyoteGameHelpMessage')
export const isPublishCoyoteGameHypothesisMessage = (prop: PublishMessage): prop is PublishCoyoteGameHypothesisMessage => (prop.displayProtocol === 'CoyoteGameHypothesisMessage')
export const isPublishCommandTranscriptMessage = (prop: PublishMessage): prop is PublishCommandTranscriptMessage => (
    prop.displayProtocol === 'CommandTranscriptMessage'
)
export const isCharacterMessage = (prop: PublishMessage): prop is (PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage) => (['SayMessage', 'NarrateMessage', 'OOCMessage'].includes(prop.displayProtocol))

export const isPerceptionPublishMessage = (prop: PublishMessage): prop is PublishPerceptionMessage => (prop.displayProtocol === 'PerceptionMessage')

export { isReturnValueMessage, isErrorMessage }

export const isRegisterCharacterMessage = (prop: MessageType): prop is RegisterCharacterMessage => (prop.type === 'RegisterCharacter')

export const isEphemeraUpdate = (prop: MessageType): prop is EphemeraUpdateMessage => (prop.type === 'EphemeraUpdate')
export const isFetchPlayerEphemera = (prop: MessageType): prop is FetchPlayerEphemeraMessage => (prop.type === 'FetchPlayerEphemera')
export const isMapSubscription = (prop: MessageType): prop is MapSubscriptionMessage => (prop.type === 'SubscribeToMaps')
export const isMapUnsubscribe = (prop: MessageType): prop is MapUnsubscribeMessage => (prop.type === 'UnsubscribeFromMaps')
export const isImportDefaults = (prop: MessageType): prop is ImportDefaultsMessage => (prop.type === 'ImportDefaults')
export const isFetchImportDefaults = (prop: MessageType): prop is FetchImportDefaultsMessage => (prop.type === 'FetchImportDefaults')
export const isCharacterEventMessage = (prop: MessageType): prop is CharacterEventMessage => (prop.type === 'CharacterEvent')

export const isPerception = (prop: MessageType): prop is PerceptionMessage => (prop.type === 'Perception')
export const isMoveCharacter = (prop: MessageType): prop is MoveCharacterMessage => (prop.type === 'MoveCharacter')
export const isCheckLocation = (prop: MessageType): prop is CheckLocationMessage => (prop.type === 'CheckLocation')
export const isCheckLocationPlayer = (prop: MessageType): prop is CheckLocationPlayerMessage => (isCheckLocation(prop) && 'characterId' in prop)
export const isCheckLocationRoom = (prop: MessageType): prop is CheckLocationRoomMessage => (isCheckLocation(prop) && 'roomId' in prop)
export const isCheckLocationAsset = (prop: MessageType): prop is CheckLocationAssetMessage => (isCheckLocation(prop) && 'assetId' in prop)

export const isRoomUpdateMessage = (prop: MessageType): prop is RoomUpdateMessage => (prop.type === 'RoomUpdate')
export const isMapUpdateMessage = (prop: MessageType): prop is MapUpdateMessage => (prop.type === 'MapUpdate')
export const isCanonUpdateMessage = (prop: MessageType): prop is CanonUpdateMessage => (['CanonAdd', 'CanonRemove', 'CanonSet'].includes(prop.type))

export const isExecuteActionMessage = (prop: MessageType): prop is ExecuteActionMessage => (prop.type === 'ExecuteAction')
export const isStreamingEventMessage = (prop: MessageType): prop is StreamingEventMessage => (prop.type === 'StreamingEvent')

export class MessageBus extends InternalMessageBus<MessageType> {}
