import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'
import { EventBridgeUpdatePlayerCharacter, EventBridgeUpdatePlayerAsset } from '@tonylb/mtw-interfaces/dist/eventBridge'
import { FeatureDescription, RoomDescription, CharacterDescription, TaggedMessageContentFlat, TaggedNotificationContent } from "@tonylb/mtw-interfaces/dist/messages"
import { LegalCharacterColor, isEphemeraTaggedId, EphemeraActionId, EphemeraMessageId, isEphemeraMessageId, isEphemeraRoomId, isEphemeraFeatureId, isEphemeraCharacterId, EphemeraMomentId, isEphemeraMomentId, EphemeraAssetId, EphemeraKnowledgeId, isEphemeraKnowledgeId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { DependencyGraphAction, RoomCharacterListItem } from "../internalCache/baseClasses"
import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraMapId,
    EphemeraRoomId,
    isEphemeraMapId
} from "@tonylb/mtw-interfaces/dist/baseClasses"
import { EphemeraClientMessageEphemeraUpdateItem } from "@tonylb/mtw-interfaces/dist/ephemera"
import { KnowledgeDescription } from "@tonylb/mtw-interfaces/dist/messages"

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

export type ConnectMessage = {
    type: 'Connect';
    userName: string;
}

export type SyncRequest = {
    type: 'Sync';
    targetId: EphemeraCharacterId;
    LastEvaluatedKey?: Record<string, AttributeValue>;
    startingAt?: number;
    limit?: number;
    loopCount?: number;
}

export type SyncNotificationRequest = {
    type: 'SyncNotification';
    LastEvaluatedKey?: Record<string, AttributeValue>;
    startingAt?: number;
    limit?: number;
    loopCount?: number;
}

export type SyncResponse = {
    type: 'SyncResponse',
    messages: any[];
    lastSync?: number;
}

export type SyncNotificationResponse = {
    type: 'SyncNotificationResponse';
    notifications: any[];
    lastSync?: number;
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

export type EphemeraUpdateMessage = {
    type: 'EphemeraUpdate';
    updates: (EphemeraClientMessageEphemeraUpdateItem & { targets: EphemeraPublishTarget[] })[];
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

export type PerceptionRoomMessage = {
    type: 'Perception';
    characterId?: EphemeraCharacterId;
    ephemeraId: EphemeraRoomId;
    header?: boolean;
}

export type PerceptionComponentMessage = {
    type: 'Perception';
    characterId?: EphemeraCharacterId;
    ephemeraId: EphemeraFeatureId | EphemeraCharacterId | EphemeraKnowledgeId;
}

export type PerceptionMapMessage = {
    type: 'Perception';
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraMapId;
    mustIncludeRoomId?: EphemeraRoomId;
}

export type PerceptionShowMessage = {
    type: 'Perception';
    characterId?: EphemeraCharacterId;
    onlyForAssets?: string[];
    ephemeraId: EphemeraMessageId;
}

export type PerceptionShowMoment = {
    type: 'Perception';
    ephemeraId: EphemeraMomentId;
}

export type PerceptionMessage = PerceptionRoomMessage | PerceptionComponentMessage | PerceptionMapMessage | PerceptionShowMessage | PerceptionShowMoment

export const isPerceptionRoomMessage = (message: PerceptionMessage): message is PerceptionRoomMessage => (isEphemeraRoomId(message.ephemeraId))
export const isPerceptionComponentMessage = (message: PerceptionMessage): message is PerceptionComponentMessage => (isEphemeraFeatureId(message.ephemeraId) || isEphemeraCharacterId(message.ephemeraId) || isEphemeraKnowledgeId(message.ephemeraId))
export const isPerceptionMapMessage = (message: PerceptionMessage): message is PerceptionMapMessage => (isEphemeraMapId(message.ephemeraId))
export const isPerceptionShowMessage = (message: PerceptionMessage): message is PerceptionShowMessage => (isEphemeraMessageId(message.ephemeraId))
export const isPerceptionShowMoment = (message: PerceptionMessage): message is PerceptionShowMoment => (isEphemeraMomentId(message.ephemeraId))

export type MoveCharacterMessage = {
    type: 'MoveCharacter';
    characterId: EphemeraCharacterId;
    roomId: EphemeraRoomId;
    leaveMessage?: string;
}

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

export type DescentUpdateMessage = {
    type: 'DescentUpdate';
} & DependencyGraphAction

export type AncestryUpdateMessage = {
    type: 'AncestryUpdate';
} & DependencyGraphAction

export type DependencyCascadeMessage = {
    type: 'DependencyCascade';
    targetId: string;
}

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

export type MessageType = PublishMessage |
    PublishNotification |
    ReturnValueMessage |
    DisconnectMessage |
    ConnectMessage |
    SyncRequest |
    SyncResponse |
    SyncNotificationRequest |
    SyncNotificationResponse |
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
    DecacheAssetMessage |
    CacheAssetMessage |
    CacheAssetByIdMessage |
    CacheCharacterAssetsMessage |
    PlayerUpdateMessage |
    RoomUpdateMessage |
    DescentUpdateMessage |
    AncestryUpdateMessage |
    DependencyCascadeMessage |
    ExecuteActionMessage |
    MapUpdateMessage

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
export const isConnectMessage = (prop: MessageType): prop is ConnectMessage => (prop.type === 'Connect')

export const isSyncRequest = (prop: MessageType): prop is SyncRequest => (prop.type === 'Sync')
export const isSyncResponse = (prop: MessageType): prop is SyncResponse => (prop.type === 'SyncResponse')
export const isSyncNotificationRequest = (prop: MessageType): prop is SyncNotificationRequest => (prop.type === 'SyncNotification')
export const isSyncNotificationResponse = (prop: MessageType): prop is SyncNotificationResponse => (prop.type === 'SyncNotificationResponse')
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

export const isDecacheAsset = (prop: MessageType): prop is DecacheAssetMessage => (prop.type === 'DecacheAsset')
export const isCacheAssetMessage = (prop: MessageType): prop is CacheAssetMessage => (prop.type === 'CacheAsset')
export const isCacheAssetByIdMessage = (prop: MessageType): prop is CacheAssetByIdMessage => (prop.type === 'CacheAssetById')
export const isCacheCharacterAssetsMessage = (prop: MessageType): prop is CacheCharacterAssetsMessage => (prop.type === 'CacheCharacterAssets')

export const isPlayerUpdateMessage = (prop: MessageType): prop is PlayerUpdateMessage => (prop.type === 'PlayerUpdate')
export const isRoomUpdateMessage = (prop: MessageType): prop is RoomUpdateMessage => (prop.type === 'RoomUpdate')
export const isMapUpdateMessage = (prop: MessageType): prop is MapUpdateMessage => (prop.type === 'MapUpdate')

export const isDescentUpdateMessage = (prop: MessageType): prop is DescentUpdateMessage => (prop.type === 'DescentUpdate')
export const isAncestryUpdateMessage = (prop: MessageType): prop is AncestryUpdateMessage => (prop.type === 'AncestryUpdate')
export const isDependencyCascadeMessage = (prop: MessageType): prop is DependencyCascadeMessage => (prop.type === 'DependencyCascade')
export const isExecuteActionMessage = (prop: MessageType): prop is ExecuteActionMessage => (prop.type === 'ExecuteAction')

export class MessageBus extends InternalMessageBus<MessageType> {}
