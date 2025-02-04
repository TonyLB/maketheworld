import { Message } from '@tonylb/mtw-interfaces/ts/messages'

//
// To efficiently insert Messages into the sorted state array, it helps to take advantage of its
// sorted nature in deducing the correct insert location
//
export const binarySearch = (arr: Message[], createdTime: number, messageId?: string): { exactMatch: boolean; index: number } => {
    let bottom = 0
    let top = arr.length - 1
    while (top >= bottom) {
        const mid = (top + bottom) >>> 1
        const search = arr[mid].CreatedTime
        if (search === createdTime) {
            const searchMessageId = arr[mid].MessageId
            if (!messageId || (searchMessageId === messageId)) {
                return { exactMatch: true, index: mid }
            }
            if (searchMessageId.localeCompare(messageId) === 1) {
                top = mid - 1
            }
            else {
                bottom = mid + 1
            }
        }
        else {
            if (search > createdTime) {
                top = mid - 1
            }
            else {
                bottom = mid + 1
            }
        }
    }
    return { exactMatch: false, index: bottom }
}

export default binarySearch
