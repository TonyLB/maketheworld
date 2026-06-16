import { MessageBus, MapUpdateMessage } from "../messageBus/baseClasses"

/** Intentional no-op during server map runtime redesign. See dataSource/maps/AGENT.md. */
export const mapUpdateMessage = async ({ payloads, messageBus }: { payloads: MapUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    void payloads
    void messageBus
}

export default mapUpdateMessage
