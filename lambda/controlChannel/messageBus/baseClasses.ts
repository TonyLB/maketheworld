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

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}

export type MessageType = PublishMessage | ReturnValueMessage

export const isPublishMessage = (prop: MessageType): prop is PublishMessage => (prop.type === 'PublishMessage')
export const isWorldMessage = (prop: PublishMessage): prop is PublishWorldMessage => (prop.displayProtocol === 'WorldMessage')

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
