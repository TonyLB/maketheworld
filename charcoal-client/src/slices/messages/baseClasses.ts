import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Message } from "@tonylb/mtw-interfaces/ts/messages"

export type MessageState = Record<EphemeraCharacterId, Message[]>

export type MessageIdAggregate = {
    earliestCreatedTime: number
    latestCreatedTime: number
}

/** Per `Target`, per logical `MessageId`, min/max `CreatedTime` across history rows. */
export type MessageAggregatesState = Record<EphemeraCharacterId, Record<string, MessageIdAggregate>>

export type MessagesSliceState = {
    history: MessageState
    aggregates: MessageAggregatesState
}
