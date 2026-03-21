import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Message } from "@tonylb/mtw-interfaces/ts/messages"

export type MessageState = Record<EphemeraCharacterId, Message[]>

export type MessageIdAggregate = {
    earliestCreatedTime: number
    latestCreatedTime: number
}

/** Per `Target`, per logical `MessageId`, min/max `CreatedTime` across history rows. */
export type MessageAggregatesState = Record<EphemeraCharacterId, Record<string, MessageIdAggregate>>

/**
 * One row per logical MessageId per Target. Same array shape as `history`, sorted by
 * `(CreatedTime, MessageId)` for `binarySearch`, but `Message.CreatedTime` on each row
 * is overloaded for transcript position — see `toPresentationRow` in `index.ts`.
 */
export type PresentationState = MessageState

export type MessagesSliceState = {
    history: MessageState
    aggregates: MessageAggregatesState
    presentation: PresentationState
}
