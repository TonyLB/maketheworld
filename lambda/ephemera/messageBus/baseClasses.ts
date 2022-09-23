import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'
import { EventBridgeUpdatePlayerCharacter, EventBridgeUpdatePlayerAsset } from '@tonylb/mtw-interfaces/dist/eventBridge'
import { RoomCharacterListItem } from "../internalCache/baseClasses"

export type PublishTargetRoom = {
    roomId: string;
}

export type PublishTargetCharacter = {
    characterId: string;
}

export type PublishTargetExcludeCharacter = {
    excludeCharacterId: string;
}

export type PublishTarget = PublishTargetRoom | PublishTargetCharacter | PublishTargetExcludeCharacter

export const isPublishTargetRoom = (prop: PublishTarget): prop is PublishTargetRoom => (('roomId' in prop) && Boolean(prop.roomId))
export const isPublishTargetCharacter = (prop: PublishTarget): prop is PublishTargetCharacter => (('characterId' in prop) && Boolean(prop.characterId))
export const isPublishTargetExcludeCharacter = (prop: PublishTarget): prop is PublishTargetExcludeCharacter => (('excludeCharacterId' in prop) && Boolean(prop.excludeCharacterId))

export type PublishMessageBase = {
    type: 'PublishMessage';
    targets: PublishTarget[];
}

//
// TODO: Figure out how to abstract copied typescript constraints on messages
// into a central library shared between lambdas and front-end
//
type TaggedText = {
    tag: 'String';
    value: string;
}

type TaggedLineBreak = {
    tag: 'LineBreak';
}

export type TaggedLink = {
    tag: 'Link',
    RoomId: string;
    text: string;
    to: string;
}

export type TaggedMessageContent = TaggedLink | TaggedText | TaggedLineBreak;

export type PublishWorldMessage = PublishMessageBase & {
    displayProtocol: 'WorldMessage';
    message: TaggedMessageContent[];
}

export type LegalCharacterColor = 'blue' | 'pink' | 'purple' | 'green' | 'grey'

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

export type PublishMessage = PublishWorldMessage | PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage | PublishRoomUpdateMessage

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
    targetId: string;
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
    characterId: string;
}

export type EphemeraUpdateEntry = {
    type: 'CharacterInPlay';
    CharacterId: string;
    Connected: boolean;
    RoomId: string;
    Name: string;
    fileURL: string;
    Color: string;
}

export type EphemeraUpdateMessage = {
    type: 'EphemeraUpdate';
    global: boolean;
    updates: EphemeraUpdateEntry[];
}

export type FetchPlayerEphemeraMessage = {
    type: 'FetchPlayerEphemera';
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

export type PerceptionMessage = {
    type: 'Perception';
    characterId: string;
    ephemeraId: string;
}

export type MoveCharacterMessage = {
    type: 'MoveCharacter';
    characterId: string;
    roomId: string;
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

type DependencyNodeAsset = {
    tag: 'Asset';
    EphemeraId: string;
    connections: DependencyNodeAsset[];
}

export type DependencyNodeNonAsset = {
    tag: 'Variable' | 'Computed' | 'Room' | 'Feature' | 'Map'
    key?: string; // The key name by which children nodes know this parent
    completeness: 'Partial' | 'Complete';
    EphemeraId: string;
    assets: string[]
    connections: DependencyNodeNonAsset[];
}

export type DependencyNode = DependencyNodeAsset | DependencyNodeNonAsset

export type DependencyNodeEphemeraStorage = Omit<DependencyNodeNonAsset, 'completeness' | 'assets'>

type DependencyUpdateAssetMessage = {
    tag: 'Asset';
    targetId: string;
    putItem?: Omit<DependencyNode, 'connections' | 'tag'>;
    deleteItem?: Omit<DependencyNodeAsset, 'connections' | 'tag'>;
}

export type NonAssetDependencyTag = 'Variable' | 'Computed' | 'Room' | 'Feature' | 'Map'
export type DependencyUpdateNonAssetMessage = {
    tag: NonAssetDependencyTag
    targetId: string;
    assetId: string;
    putItem?: Omit<DependencyNodeEphemeraStorage, 'connections' | 'tag'>;
    deleteItem?: Omit<DependencyNodeEphemeraStorage, 'connections' | 'tag'>;
}

export type DependencyUpdateMessage = DependencyUpdateAssetMessage | DependencyUpdateNonAssetMessage

export type DescentUpdateAssetMessage = {
    type: 'DescentUpdate';
} & DependencyUpdateAssetMessage

export type DescentUpdateNonAssetMessage = {
    type: 'DescentUpdate';
} & DependencyUpdateNonAssetMessage

export type DescentUpdateMessage = {
    type: 'DescentUpdate';
} & DependencyUpdateMessage

export type AncestryUpdateAssetMessage = {
    type: 'AncestryUpdate';
} & DependencyUpdateAssetMessage

export type AncestryUpdateNonAssetMessage = {
    type: 'AncestryUpdate';
} & DependencyUpdateNonAssetMessage

export type AncestryUpdateMessage = AncestryUpdateAssetMessage | AncestryUpdateNonAssetMessage

export type DependencyCascadeMessage = {
    type: 'DependencyCascade';
    targetId: string;
    tag: NonAssetDependencyTag;
    Descent: DependencyNodeNonAsset[];
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
    DependencyCascadeMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')
export const isCharacterMessage = (prop: PublishMessage): prop is (PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage) => (['SayMessage', 'NarrateMessage', 'OOCMessage'].includes(prop.displayProtocol))
export const isRoomUpdatePublishMessage = (prop: PublishMessage): prop is PublishRoomUpdateMessage => (prop.displayProtocol === 'RoomUpdate')

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isDisconnectMessage = (prop: MessageType): prop is DisconnectMessage => (prop.type === 'Disconnect')
export const isConnectMessage = (prop: MessageType): prop is ConnectMessage => (prop.type === 'Connect')
export const isWhoAmIMessage = (prop: MessageType): prop is WhoAmIMessage => (prop.type === 'WhoAmI')

export const isSyncRequest = (prop: MessageType): prop is SyncRequest => (prop.type === 'Sync')
export const isSyncResponse = (prop: MessageType): prop is SyncResponse => (prop.type === 'SyncResponse')
export const isRegisterCharacterMessage = (prop: MessageType): prop is RegisterCharacterMessage => (prop.type === 'RegisterCharacter')

export const isEphemeraUpdate = (prop: MessageType): prop is EphemeraUpdateMessage => (prop.type === 'EphemeraUpdate')
export const isFetchPlayerEphemera = (prop: MessageType): prop is FetchPlayerEphemeraMessage => (prop.type === 'FetchPlayerEphemera')
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

export class MessageBus extends InternalMessageBus<MessageType> {}
