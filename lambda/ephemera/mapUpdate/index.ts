import { MessageBus, MapUpdateMessage } from "../messageBus/baseClasses"

export const mapUpdateMessage = async ({ payloads, messageBus }: { payloads: MapUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    void payloads
    void messageBus
}

export default mapUpdateMessage
