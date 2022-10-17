import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { Message } from "@tonylb/mtw-interfaces/dist/messages"

export type MessageState = Record<EphemeraCharacterId, Message[]>
