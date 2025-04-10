import { CharacterEventMessage, MessageBus } from "../messageBus/baseClasses";

//
// characterEvent message handler accepts incoming character change events and handles updates to
// the character library, and to the activeCharacter lists of rooms.
//
export const characterEvent = async ({ payloads, messageBus }: { payloads: CharacterEventMessage[], messageBus: MessageBus }): Promise<void> => {

}

export default characterEvent
