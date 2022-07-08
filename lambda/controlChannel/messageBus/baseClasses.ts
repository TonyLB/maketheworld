import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

export type PublishMessageBase = {
    type: 'PublishMessage';
    targets: string[];
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

type TaggedActionLink = {
    targetTag: 'Action';
    toAssetId: string;
    toAction: string;
}

type TaggedFeatureLink = {
    targetTag: 'Feature';
    toFeatureId: string;
}

type TaggedLinkPayload = TaggedActionLink | TaggedFeatureLink

export type TaggedLink = {
    tag: 'Link',
    RoomId: string;
    text: string;
} & TaggedLinkPayload

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

export type PublishOutOfCharacterMessage = PublishMessageBase & MessageCharacterInfo & {
    displayProtocol: 'OOCMessage';
    message: TaggedMessageContent[];
}

export type PublishMessage = PublishWorldMessage | PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage

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
}

export type EphemeraUpdateMessage = {
    type: 'EphemeraUpdate';
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
    exitName?: string;
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
    MoveCharacterMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')
export const isCharacterMessage = (prop: PublishMessage): prop is (PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage) => (['SayMessage', 'NarrateMessage', 'OOCMessage'].includes(prop.displayProtocol))

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

export class MessageBus extends InternalMessageBus<MessageType> {}
