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

export type MessageType = PublishMessage | ReturnValueMessage | DisconnectMessage | ConnectMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')
export const isCharacterMessage = (prop: PublishMessage): prop is (PublishSpeechMessage | PublishNarrateMessage | PublishOutOfCharacterMessage) => (['SayMessage', 'NarrateMessage', 'OOCMessage'].includes(prop.displayProtocol))

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isDisconnectMessage = (prop: MessageType): prop is DisconnectMessage => (prop.type === 'Disconnect')
export const isConnectMessage = (prop: MessageType): prop is ConnectMessage => (prop.type === 'Connect')
