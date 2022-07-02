export type NullMessage = {
    type: 'Null',
}

export type PublishMessageBase = {
    type: 'PublishMessage';
    targets: string[];
    global?: false;
} | {
    type: 'PublishMessage';
    global: true;
}
export type PublishWorldMessage = PublishMessageBase & {
    displayProtocol: 'WorldMessage';
    message: string;
}

export type PublishMessage = PublishWorldMessage

export type MessageType = NullMessage | PublishMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')
