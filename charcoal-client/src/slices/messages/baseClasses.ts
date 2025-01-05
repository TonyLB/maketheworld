import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Message } from "@tonylb/mtw-interfaces/ts/messages"

export type MessageState = Record<EphemeraCharacterId, Message[]>
