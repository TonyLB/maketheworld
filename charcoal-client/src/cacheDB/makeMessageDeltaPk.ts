import type { Message } from '@tonylb/mtw-interfaces/ts/messages'

/**
 * IndexedDB primary key for cached messages. Matches server message_delta DeltaId shape
 * (`${CreatedTime}::${MessageId}`) without the Target prefix.
 */
export const makeMessageDeltaPk = (message: Pick<Message, 'CreatedTime' | 'MessageId'>): string =>
    `${message.CreatedTime}::${message.MessageId}`

/** Remove Dexie-only `deltaPk` before storing rows in Redux (same wire shape as `Message`). */
export const stripMessageDeltaPk = (row: Message & { deltaPk: string }): Message => {
    const { deltaPk: _omit, ...rest } = row
    return rest
}
