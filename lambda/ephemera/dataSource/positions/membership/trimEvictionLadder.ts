import type { RoomStackItem } from './types'

/** Omitted timeWritten = legacy 0 (RS-4); first navigate persist stamps frames. */
export const DEFAULT_ROOM_STACK: RoomStackItem[] = [{ asset: 'primitives', RoomId: 'VORTEX' }]

export const normalizeRoomStack = (stack: RoomStackItem[] | undefined): RoomStackItem[] =>
    stack?.length ? stack : DEFAULT_ROOM_STACK

/**
 * Filter eviction-ladder frames to assets the character can still access.
 * Shared legal-placement primitive: connect (from nowhere) and asset visibility (from illegal room).
 */
export const trimRoomStackToAccessibleAssets = (
    stack: RoomStackItem[] | undefined,
    accessibleAssets: string[]
): RoomStackItem[] =>
    normalizeRoomStack(stack).filter(({ asset }) => accessibleAssets.includes(asset))

export const roomStackTopRoomShortId = (stack: RoomStackItem[]): string | undefined =>
    stack.slice(-1)[0]?.RoomId

export const roomStacksEqual = (left: RoomStackItem[], right: RoomStackItem[]): boolean =>
    left.length === right.length
    && left.every((frame, index) => (
        frame.asset === right[index]?.asset
        && frame.RoomId === right[index]?.RoomId
    ))
