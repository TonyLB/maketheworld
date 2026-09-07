import type { RoomStackItem } from './types'

export const maxRoomStackTimeWritten = (stack: RoomStackItem[]): number =>
    stack.reduce((max, frame) => Math.max(max, frame.timeWritten ?? 0), 0)

/**
 * Navigate follow-up merge: apply algorithm `proposed` into stored `current` at `writeTime`
 * (beatAnchorTime from graph persist). Older navigates cannot regress newer frames.
 */
export const mergeRoomStack = (
    current: RoomStackItem[],
    proposed: RoomStackItem[],
    writeTime: number
): RoomStackItem[] => {
    const maxCurrentTime = maxRoomStackTimeWritten(current)
    const merged: RoomStackItem[] = []

    for (let i = 0; i < proposed.length; i++) {
        if (i < current.length) {
            if (writeTime >= (current[i].timeWritten ?? 0)) {
                merged.push({ ...proposed[i], timeWritten: writeTime })
            } else {
                merged.push(current[i])
            }
            continue
        }

        if (writeTime > maxCurrentTime) {
            merged.push({ ...proposed[i], timeWritten: writeTime })
        }
    }

    for (let i = proposed.length; i < current.length; i++) {
        if ((current[i].timeWritten ?? 0) > writeTime) {
            merged.push(current[i])
        }
    }

    return merged
}
