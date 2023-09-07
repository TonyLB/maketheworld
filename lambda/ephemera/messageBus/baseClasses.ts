import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { EventBridgeUpdatePlayerCharacter, EventBridgeUpdatePlayerAsset } from '@tonylb/mtw-interfaces/dist/eventBridge'
import { FeatureDescription, RoomDescription, CharacterDescription, TaggedMessageContentFlat, TaggedNotificationContent } from "@tonylb/mtw-interfaces/dist/messages"
import { LegalCharacterColor, isEphemeraTaggedId, EphemeraActionId, EphemeraMessageId, isEphemeraMessageId, isEphemeraRoomId, isEphemeraFeatureId, isEphemeraCharacterId, EphemeraMomentId, isEphemeraMomentId, EphemeraAssetId, EphemeraKnowledgeId, isEphemeraKnowledgeId, isEphemeraAssetId, } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { RoomCharacterListItem } from "../internalCache/baseClasses"
import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraMapId,
    EphemeraRoomId,
    isEphemeraMapId
} from "@tonylb/mtw-interfaces/dist/baseClasses"
import { EphemeraClientMessageEphemeraUpdateCharacterInPlayActive, EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive, EphemeraClientMessageEphemeraUpdateItem, EphemeraClientMessageEphemeraUpdateMapClear, EphemeraClientMessageEphemeraUpdateMapItem } from "@tonylb/mtw-interfaces/dist/ephemera"
import { KnowledgeDescription } from "@tonylb/mtw-interfaces/dist/messages"
import { MessageGroupId } from "../internalCache/orchestrateMessages"

export type PublishTargetRoom = `ROOM#${string}`

export type PublishTargetCharacter = `CHARACTER#${string}`
export type PublishTargetExcludeCharacter = `!CHARACTER#${string}`

export type PublishTargetConnection = `CONNECTION#${string}`
export type PublishTargetExcludeConnection = `!CONNECTION#${string}`

export type PublishTargetGlobal = `GLOBAL`

export type PublishTarget = PublishTargetRoom | PublishTargetCharacter | PublishTargetExcludeCharacter

export const isPublishTargetRoom = isEphemeraTaggedId<'ROOM'>('ROOM')
export const isPublishTargetCharacter = isEphemeraTaggedId<'CHARACTER'>('CHARACTER')
export const isPublishTargetExcludeCharacter = isEphemeraTaggedId<'!CHARACTER'>('!CHARACTER')
export const isPublishTargetConnection = isEphemeraTaggedId<'CONNECTION'>('CONNECTION')
export const isPublishTargetExcludeConnection = isEphemeraTaggedId<'!CONNECTION'>('!CONNECTION')
export const isPublishTargetGlobal = (key: string): key is PublishTargetGlobal => (key === 'GLOBAL')

export type PublishMessageBase = {
    type: 'PublishMessage';
    targets: PublishTarget[];
    messageGroupId?: MessageGroupId;
}

export type PublishWorldMessage = PublishMessageBase & {
    displayProtocol: 'WorldMessage';
    message: TaggedMessageContentFlat[];
}

type MessageCharacterInfo = {
    characterId: EphemeraCharacterId;
    name: string;
    color: LegalCharacterColor;
}

export type PublishSpeechMessage = PublishMessageBase & MessageCharacterInfo & {
    displayProtocol: 'SayMessage';
    message: TaggedMessageContentFlat[];
}

export type PublishNarrateMessage = PublishMessageBase & MessageCharacterInfo & {
    displayProtocol: 'NarrateMessage';
    message: TaggedMessageContentFlat[];
}

export type PublishOutOfCharacterMessage = {
    displayProtocol: 'OOCMessage';
    message: TaggedMessageContentFlat[];
} & PublishMessageBase & MessageCharacterInfo

export type PublishRoomUpdateMessage = {
    displayProtocol: 'RoomUpdate';
    RoomId: EphemeraRoomId;
    Characters: (Omit<RoomCharacterListItem, 'EphemeraId' | 'ConnectionIds'> & { CharacterId: string })[];
} & PublishMessageBase

export type PublishFeatureDescriptionMessage = Omit<FeatureDescription, 'DisplayProtocol' | 'MessageId' | 'CreatedTime' | 'Target'> & {
    displayProtocol: 'FeatureDescription';
} & PublishMessageBase

export type PublishKnowledgeDescriptionMessage = Omit<KnowledgeDescription, 'DisplayProtocol' | 'MessageId' | 'CreatedTime' | 'Target'> & {
    displayProtocol: 'KnowledgeDescription';
} & PublishMessageBase

export type PublishRoomDescriptionMessage = Omit<RoomDescription, 'DisplayProtocol' | 'MessageId' | 'CreatedTime' | 'Target'> & {
    displayProtocol: 'RoomDescription' | 'RoomHeader';
} & PublishMessageBase

export type PublishCharacterDescriptionMessage = Omit<CharacterDescription, 'DisplayProtocol' | 'MessageId' | 'CreatedTime' | 'Target'> & {
    displayProtocol: 'CharacterDescription';
} & PublishMessageBase

export type PublishMessage = PublishWorldMessage |
    PublishSpeechMessage |
    PublishNarrateMessage |
    PublishOutOfCharacterMessage |
    PublishRoomUpdateMessage |
    PublishFeatureDescriptionMessage |
    PublishKnowledgeDescriptionMessage |
    PublishRoomDescriptionMessage |
    PublishCharacterDescriptionMessage

export type PublishNotificationBase = {
    type: 'PublishNotification';
    target: string;
    subject: string;
}
    
export type PublishInformationNotification = {
    displayProtocol: 'Information';
    message: TaggedNotificationContent[];
} & PublishNotificationBase

export type PublishUpdateMarksNotification = {
    type: 'PublishNotification';
    displayProtocol: 'UpdateMarks';
    target: string;
    notificationId: `NOTIFICATION#${string}`;
    read: boolean;
    archived: boolean;
}

export type PublishNotification = PublishInformationNotification | PublishUpdateMarksNotification

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}

export type DisconnectMessage = {
    type: 'Disconnect';
    connectionId: string;
}

export type RegisterCharacterMessage = {
    type: 'RegisterCharacter';
    characterId: EphemeraCharacterId;
}

export type UnregisterCharacterMessage = {
    type: 'UnregisterCharacter';
    characterId: EphemeraCharacterId;
}

export type EphemeraPublishTarget = PublishTargetCharacter | PublishTargetConnection | PublishTargetGlobal | PublishTargetExcludeCharacter | PublishTargetExcludeConnection

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
} & PerceptionBase

export type PerceptionMapMessage = {
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraMapId;
    mustIncludeRoomId?: EphemeraRoomId;
} & PerceptionBase

export type PerceptionShowMessage = {
    characterId?: EphemeraCharacterId;
    onlyForAssets?: string[];
    ephemeraId: EphemeraMessageId;
} & PerceptionBase

export type PerceptionShowMoment = {
    ephemeraId: EphemeraMomentId;
} & PerceptionBase

export type PerceptionMessage = PerceptionAssetMessage | PerceptionRoomMessage | PerceptionComponentMessage | PerceptionMapMessage | PerceptionShowMessage | PerceptionShowMoment

export const isPerceptionAssetMessage = (message: PerceptionMessage): message is PerceptionAssetMessage => (isEphemeraAssetId(message.ephemeraId))
export const isPerceptionRoomMessage = (message: PerceptionMessage): message is PerceptionRoomMessage => (isEphemeraRoomId(message.ephemeraId))
export const isPerceptionComponentMessage = (message: PerceptionMessage): message is PerceptionComponentMessage => (isEphemeraFeatureId(message.ephemeraId) || isEphemeraCharacterId(message.ephemeraId) || isEphemeraKnowledgeId(message.ephemeraId))
export const isPerceptionMapMessage = (message: PerceptionMessage): message is PerceptionMapMessage => (isEphemeraMapId(message.ephemeraId))
export const isPerceptionShowMessage = (message: PerceptionMessage): message is PerceptionShowMessage => (isEphemeraMessageId(message.ephemeraId))
export const isPerceptionShowMoment = (message: PerceptionMessage): message is PerceptionShowMoment => (isEphemeraMomentId(message.ephemeraId))

export type MoveCharacterMessage = {
    type: 'MoveCharacter';
    characterId: EphemeraCharacterId;
    roomId: EphemeraRoomId;
    arriveMessage?: string;
    leaveMessage?: string;
    suppressSelfMessage?: boolean;
}

export type CheckLocationMessageInvariantPayload = {
    type: 'CheckLocation';
    forceMove?: boolean;
    forceRender?: boolean;
    arriveMessage?: string;
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

export type DecacheAssetMessage = {
    type: 'DecacheAsset';
    assetId: string;
}

type CacheAssetOptions = {
    check?: boolean;
    updateOnly?: boolean;
}

export type CacheAssetMessage = {
    type: 'CacheAsset';
    address: AssetWorkspaceAddress;
    options: CacheAssetOptions;
}

export type CacheAssetByIdMessage = {
    type: 'CacheAssetById';
    assetId: EphemeraAssetId;
}

export type CacheCharacterAssetsMessage = {
    type: 'CacheCharacterAssets';
    characterId: EphemeraCharacterId;
}

export type PlayerUpdateMessage = {
    type: 'PlayerUpdate';
    player: string;
    Characters: EventBridgeUpdatePlayerCharacter[];
    Assets: EventBridgeUpdatePlayerAsset[];
    guestName?: string;
    guestId?: string;
}

export type RoomUpdateMessage = {
    type: 'RoomUpdate';
    roomId: EphemeraRoomId;
    render?: boolean;
}

export type LegalDependencyTag = 'Asset' | 'Variable' | 'Computed' | 'Room' | 'Feature' | 'Map'
export const isLegalDependencyTag = (tag: string): tag is LegalDependencyTag => (['Asset', 'Variable', 'Computed', 'Room', 'Feature', 'Map'].includes(tag))

export type ExecuteActionMessage = {
    type: 'ExecuteAction';
    actionId: EphemeraActionId;
    characterId: EphemeraCharacterId;
}

export type MapUpdateMessage = {
    type: 'MapUpdate';
    characterId?: EphemeraCharacterId;
    connectionId?: string;
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

export type MessageType = PublishMessage |
    PublishNotification |
    ReturnValueMessage |
    DisconnectMessage |
    RegisterCharacterMessage |
    UnregisterCharacterMessage |
    EphemeraUpdateMessage |
    FetchPlayerEphemeraMessage |
    MapSubscriptionMessage |
    MapUnsubscribeMessage |
    ImportDefaultsMessage |
    FetchImportDefaultsMessage |
    PerceptionMessage |
    MoveCharacterMessage |
    CheckLocationMessage |
    DecacheAssetMessage |
    CacheAssetMessage |
    CacheAssetByIdMessage |
    CacheCharacterAssetsMessage |
    PlayerUpdateMessage |
    RoomUpdateMessage |
    ExecuteActionMessage |
    MapUpdateMessage |
    CanonUpdateMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')
export const isCharacterMessage = (prop: PublishMessage): prop is (PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage) => (['SayMessage', 'NarrateMessage', 'OOCMessage'].includes(prop.displayProtocol))
export const isRoomUpdatePublishMessage = (prop: PublishMessage): prop is PublishRoomUpdateMessage => (prop.displayProtocol === 'RoomUpdate')
export const isRoomDescriptionPublishMessage = (prop: PublishMessage): prop is PublishRoomDescriptionMessage => (['RoomDescription', 'RoomHeader'].includes(prop.displayProtocol))
export const isFeatureDescriptionPublishMessage = (prop: PublishMessage): prop is PublishFeatureDescriptionMessage => (prop.displayProtocol === 'FeatureDescription')
export const isKnowledgeDescriptionPublishMessage = (prop: PublishMessage): prop is PublishKnowledgeDescriptionMessage => (prop.displayProtocol === 'KnowledgeDescription')
export const isCharacterDescriptionPublishMessage = (prop: PublishMessage): prop is PublishCharacterDescriptionMessage => (prop.displayProtocol === 'CharacterDescription')

export const isPublishNotification = (prop: MessageType): prop is PublishNotification => (prop.type === 'PublishNotification')
export const isInformationNotification = (prop: PublishNotification): prop is PublishInformationNotification => (prop.displayProtocol === 'Information')

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isDisconnectMessage = (prop: MessageType): prop is DisconnectMessage => (prop.type === 'Disconnect')

export const isRegisterCharacterMessage = (prop: MessageType): prop is RegisterCharacterMessage => (prop.type === 'RegisterCharacter')
export const isUnregisterCharacterMessage = (prop: MessageType): prop is UnregisterCharacterMessage => (prop.type === 'UnregisterCharacter')

export const isEphemeraUpdate = (prop: MessageType): prop is EphemeraUpdateMessage => (prop.type === 'EphemeraUpdate')
export const isFetchPlayerEphemera = (prop: MessageType): prop is FetchPlayerEphemeraMessage => (prop.type === 'FetchPlayerEphemera')
export const isMapSubscription = (prop: MessageType): prop is MapSubscriptionMessage => (prop.type === 'SubscribeToMaps')
export const isMapUnsubscribe = (prop: MessageType): prop is MapUnsubscribeMessage => (prop.type === 'UnsubscribeFromMaps')
export const isImportDefaults = (prop: MessageType): prop is ImportDefaultsMessage => (prop.type === 'ImportDefaults')
export const isFetchImportDefaults = (prop: MessageType): prop is FetchImportDefaultsMessage => (prop.type === 'FetchImportDefaults')

export const isPerception = (prop: MessageType): prop is PerceptionMessage => (prop.type === 'Perception')
export const isMoveCharacter = (prop: MessageType): prop is MoveCharacterMessage => (prop.type === 'MoveCharacter')
export const isCheckLocation = (prop: MessageType): prop is CheckLocationMessage => (prop.type === 'CheckLocation')
export const isCheckLocationPlayer = (prop: MessageType): prop is CheckLocationPlayerMessage => (isCheckLocation(prop) && 'characterId' in prop)
export const isCheckLocationRoom = (prop: MessageType): prop is CheckLocationRoomMessage => (isCheckLocation(prop) && 'roomId' in prop)
export const isCheckLocationAsset = (prop: MessageType): prop is CheckLocationAssetMessage => (isCheckLocation(prop) && 'assetId' in prop)

export const isDecacheAsset = (prop: MessageType): prop is DecacheAssetMessage => (prop.type === 'DecacheAsset')
export const isCacheAssetMessage = (prop: MessageType): prop is CacheAssetMessage => (prop.type === 'CacheAsset')
export const isCacheAssetByIdMessage = (prop: MessageType): prop is CacheAssetByIdMessage => (prop.type === 'CacheAssetById')
export const isCacheCharacterAssetsMessage = (prop: MessageType): prop is CacheCharacterAssetsMessage => (prop.type === 'CacheCharacterAssets')

export const isPlayerUpdateMessage = (prop: MessageType): prop is PlayerUpdateMessage => (prop.type === 'PlayerUpdate')
export const isRoomUpdateMessage = (prop: MessageType): prop is RoomUpdateMessage => (prop.type === 'RoomUpdate')
export const isMapUpdateMessage = (prop: MessageType): prop is MapUpdateMessage => (prop.type === 'MapUpdate')
export const isCanonUpdateMessage = (prop: MessageType): prop is CanonUpdateMessage => (['CanonAdd', 'CanonRemove', 'CanonSet'].includes(prop.type))

export const isExecuteActionMessage = (prop: MessageType): prop is ExecuteActionMessage => (prop.type === 'ExecuteAction')

export class MessageBus extends InternalMessageBus<MessageType> {}
