/** One eviction-ladder frame: the room a character last held within an asset layer. */
export type RoomStackItem = {
    asset: string;
    RoomId: string;
    /** Epoch ms: navigate beatAnchorTime on frames this write applied. Omitted/0 = legacy. */
    timeWritten?: number;
}
