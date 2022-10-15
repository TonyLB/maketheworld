import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'
import { EventBridgeUpdatePlayerCharacter, EventBridgeUpdatePlayerAsset } from '@tonylb/mtw-interfaces/dist/eventBridge'
import { TaggedMessageContent, FeatureDescription, RoomDescription, CharacterDescription } from "@tonylb/mtw-interfaces/dist/messages"
import { LegalCharacterColor, isEphemeraTaggedId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { DependencyGraphAction, RoomCharacterListItem } from "../internalCache/baseClasses"
import { EphemeraExit } from "../cacheAsset/baseClasses"
import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraMapId,
    EphemeraRoomId,
    isEphemeraMapId
} from "@tonylb/mtw-interfaces/dist/baseClasses"
import { EphemeraClientMessageEphemeraUpdateCharacterInPlay, EphemeraClientMessageEphemeraUpdateItem } from "@tonylb/mtw-interfaces/dist/ephemera"

export type PublishTargetRoom = `ROOM#${string}`

export type PublishTargetCharacter = `CHARACTER#${string}`
export type PublishTargetExcludeCharacter = `!CHARACTER#${string}`

export type PublishTargetConnection = `CONNECTION#${string}`
export type PublishTargetExcludeConnection = `!CONNECTION#${string}`

export type PublishTarget = PublishTargetRoom | PublishTargetCharacter | PublishTargetExcludeCharacter

export const isPublishTargetRoom = isEphemeraTaggedId<'ROOM'>('ROOM')
export const isPublishTargetCharacter = isEphemeraTaggedId<'CHARACTER'>('CHARACTER')
export const isPublishTargetExcludeCharacter = isEphemeraTaggedId<'!CHARACTER'>('!CHARACTER')
export const isPublishTargetConnection = isEphemeraTaggedId<'CONNECTION'>('CONNECTION')
export const isPublishTargetExcludeConnection = isEphemeraTaggedId<'!CONNECTION'>('!CONNECTION')

export type PublishMessageBase = {
    type: 'PublishMessage';
    targets: PublishTarget[];
}

export type PublishWorldMessage = PublishMessageBase & {
    displayProtocol: 'WorldMessage';
    message: TaggedMessageContent[];
}

type MessageCharacterInfo = {
    characterId: string;
    name: string;
    color: LegalCharacterColor;
}

export type PublishSpeechMessage = PublishMessageBase & MessageCharacterInfo & {
    displayProtocol: 'SayMessage';
    message: TaggedMessageContent[];
}

export type PublishNarrateMessage = PublishMessageBase & MessageCharacterInfo & {
    displayProtocol: 'NarrateMessage';
    message: TaggedMessageContent[];
}

export type PublishOutOfCharacterMessage = {
    displayProtocol: 'OOCMessage';
    message: TaggedMessageContent[];
} & PublishMessageBase & MessageCharacterInfo

export type PublishRoomUpdateMessage = {
    displayProtocol: 'RoomUpdate';
    RoomId: string;
    Characters: (Omit<RoomCharacterListItem, 'EphemeraId' | 'ConnectionIds'> & { CharacterId: string })[];
} & PublishMessageBase

export type PublishFeatureDescriptionMessage = Omit<FeatureDescription, 'DisplayProtocol' | 'MessageId' | 'CreatedTime' | 'Target'> & {
    displayProtocol: 'FeatureDescription';
} & PublishMessageBase

export type PublishRoomDescriptionMessage = Omit<RoomDescription, 'DisplayProtocol' | 'MessageId' | 'CreatedTime' | 'Target'> & {
    displayProtocol: 'RoomDescription';
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
    PublishRoomDescriptionMessage |
    PublishCharacterDescriptionMessage

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

export type WhoAmIMessage = {
    type: 'WhoAmI'
}

export type SyncRequest = {
    type: 'Sync';
    targetId: EphemeraCharacterId;
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

export type RegisterCharacterMessage = {
    type: 'RegisterCharacter';
    characterId: EphemeraCharacterId;
}

export type EphemeraUpdateCharacterEntry = {
    type: 'CharacterInPlay';
    CharacterId: string;
    Connected: boolean;
    RoomId: string;
    Name: string;
    fileURL: string;
    Color: string;
}

export type EphemeraUpdateMapEntry = {
    type: 'MapUpdate';
    targets: string[];
    MapId: string;
    Name: string;
    fileURL?: string;
    rooms: {
        roomId: string;
        name: string;
        x: number;
        y: number;
        exits: EphemeraExit[];
    }[]
}

export type EphemeraUpdateEntry = EphemeraUpdateCharacterEntry | EphemeraUpdateMapEntry;

export type EphemeraUpdateMessage = {
    type: 'EphemeraUpdate';
    global: boolean;
    updates: (EphemeraClientMessageEphemeraUpdateItem & { targets: string[] })[];
}

export type FetchPlayerEphemeraMessage = {
    type: 'FetchPlayerEphemera';
}

export type MapSubscriptionMessage = {
    type: 'SubscribeToMaps';
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

export type PerceptionNonMapMessage = {
    type: 'Perception';
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraCharacterId;
}

export type PerceptionMapMessage = {
    type: 'Perception';
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraMapId;
    mustIncludeRoomId?: EphemeraRoomId;
}

export type PerceptionMessage = PerceptionNonMapMessage | PerceptionMapMessage

export const isPerceptionMapMessage = (message: PerceptionMessage): message is PerceptionMapMessage => (isEphemeraMapId(message.ephemeraId))

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
    recursive?: boolean;
    forceCache?: boolean;
}

export type CacheAssetMessage = {
    type: 'CacheAsset';
    address: AssetWorkspaceAddress;
    options: CacheAssetOptions;
}

export type PlayerUpdateMessage = {
    type: 'PlayerUpdate';
    player: string;
    Characters: EventBridgeUpdatePlayerCharacter[];
    Assets: EventBridgeUpdatePlayerAsset[];
}

export type RoomUpdateMessage = {
    type: 'RoomUpdate';
    roomId: string;
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
    actionId: string;
    characterId: EphemeraCharacterId;
}

export type MessageType = PublishMessage |
    ReturnValueMessage |
    DisconnectMessage |
    ConnectMessage |
    WhoAmIMessage |
    SyncRequest |
    SyncResponse |
    RegisterCharacterMessage |
    EphemeraUpdateMessage |
    FetchPlayerEphemeraMessage |
    MapSubscriptionMessage |
    ImportDefaultsMessage |
    FetchImportDefaultsMessage |
    PerceptionMessage |
    MoveCharacterMessage |
    DecacheAssetMessage |
    CacheAssetMessage |
    PlayerUpdateMessage |
    RoomUpdateMessage |
    DescentUpdateMessage |
    AncestryUpdateMessage |
    DependencyCascadeMessage |
    ExecuteActionMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')
export const isCharacterMessage = (prop: PublishMessage): prop is (PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage) => (['SayMessage', 'NarrateMessage', 'OOCMessage'].includes(prop.displayProtocol))
export const isRoomUpdatePublishMessage = (prop: PublishMessage): prop is PublishRoomUpdateMessage => (prop.displayProtocol === 'RoomUpdate')
export const isRoomDescriptionPublishMessage = (prop: PublishMessage): prop is PublishRoomDescriptionMessage => (prop.displayProtocol === 'RoomDescription')
export const isFeatureDescriptionPublishMessage = (prop: PublishMessage): prop is PublishFeatureDescriptionMessage => (prop.displayProtocol === 'FeatureDescription')
export const isCharacterDescriptionPublishMessage = (prop: PublishMessage): prop is PublishCharacterDescriptionMessage => (prop.displayProtocol === 'CharacterDescription')

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isDisconnectMessage = (prop: MessageType): prop is DisconnectMessage => (prop.type === 'Disconnect')
export const isConnectMessage = (prop: MessageType): prop is ConnectMessage => (prop.type === 'Connect')
export const isWhoAmIMessage = (prop: MessageType): prop is WhoAmIMessage => (prop.type === 'WhoAmI')

export const isSyncRequest = (prop: MessageType): prop is SyncRequest => (prop.type === 'Sync')
export const isSyncResponse = (prop: MessageType): prop is SyncResponse => (prop.type === 'SyncResponse')
export const isRegisterCharacterMessage = (prop: MessageType): prop is RegisterCharacterMessage => (prop.type === 'RegisterCharacter')

export const isEphemeraUpdate = (prop: MessageType): prop is EphemeraUpdateMessage => (prop.type === 'EphemeraUpdate')
export const isFetchPlayerEphemera = (prop: MessageType): prop is FetchPlayerEphemeraMessage => (prop.type === 'FetchPlayerEphemera')
export const isMapSubscription = (prop: MessageType): prop is MapSubscriptionMessage => (prop.type === 'SubscribeToMaps')
export const isImportDefaults = (prop: MessageType): prop is ImportDefaultsMessage => (prop.type === 'ImportDefaults')
export const isFetchImportDefaults = (prop: MessageType): prop is FetchImportDefaultsMessage => (prop.type === 'FetchImportDefaults')

export const isPerception = (prop: MessageType): prop is PerceptionMessage => (prop.type === 'Perception')
export const isMoveCharacter = (prop: MessageType): prop is MoveCharacterMessage => (prop.type === 'MoveCharacter')

export const isDecacheAsset = (prop: MessageType): prop is DecacheAssetMessage => (prop.type === 'DecacheAsset')
export const isCacheAssetMessage = (prop: MessageType): prop is CacheAssetMessage => (prop.type === 'CacheAsset')

export const isPlayerUpdateMessage = (prop: MessageType): prop is PlayerUpdateMessage => (prop.type === 'PlayerUpdate')
export const isRoomUpdateMessage = (prop: MessageType): prop is RoomUpdateMessage => (prop.type === 'RoomUpdate')

export const isDescentUpdateMessage = (prop: MessageType): prop is DescentUpdateMessage => (prop.type === 'DescentUpdate')
export const isAncestryUpdateMessage = (prop: MessageType): prop is AncestryUpdateMessage => (prop.type === 'AncestryUpdate')
export const isDependencyCascadeMessage = (prop: MessageType): prop is DependencyCascadeMessage => (prop.type === 'DependencyCascade')
export const isExecuteActionMessage = (prop: MessageType): prop is ExecuteActionMessage => (prop.type === 'ExecuteAction')

export class MessageBus extends InternalMessageBus<MessageType> {}
