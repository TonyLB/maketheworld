import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import cacheDB, { LastSyncType } from '../../cacheDB'
import { Message } from '@tonylb/mtw-interfaces/dist/messages'
import { EphemeraClientMessagePublishMessages } from '@tonylb/mtw-interfaces/dist/ephemera'
import { unique } from '../../lib/lists'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

const initialState = {} as Record<string, Message[]>

//
// To efficiently insert Messages into the sorted state array, it helps to take advantage of its
// sorted nature in deducing the correct insert location
//
export const binarySearch = (arr: Message[], createdTime: number, messageId: string): { exactMatch: boolean; index: number } => {
    let bottom = 0
    let top = arr.length - 1
    while (top >= bottom) {
        const mid = (top + bottom) >>> 1
        const search = arr[mid].CreatedTime
        if (search === createdTime) {
            const searchMessageId = arr[mid].MessageId
            if (searchMessageId === messageId) {
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

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        receiveMessages(state: any, action: PayloadAction<Message[]>) {
            action.payload.forEach((message) => {
                if (state[message.Target]) {
                    const { exactMatch, index } = binarySearch(state[message.Target], message.CreatedTime, message.MessageId)
                    if (exactMatch) {
                        state[message.Target][index] = message
                    }
                    else {
                        if (index >= state[message.Target].length) {
                            state[message.Target].push(message)
                        }
                        else {
                            state[message.Target].splice(index, 0, message)
                        }
                    }    
                }
                else {
                    state[message.Target] = [message]
                }
            })
        }
    }
})

export const { receiveMessages } = messagesSlice.actions

export const cacheMessages = (payload: EphemeraClientMessagePublishMessages) => async (dispatch: any) => {
    //
    // Update LastSync data, and push messages to cacheDB
    //
    const { messages, LastSync } = payload
    const lastSyncUpdateTargets = unique(messages.map(({ Target }) => (Target))) as EphemeraCharacterId[]
    const updateLastSync = LastSync
        ? Promise.all(lastSyncUpdateTargets.map((CharacterId) => (cacheDB.characterSync
            .update(CharacterId, (storedLastSync: number) => (Math.max(LastSync ?? 0, storedLastSync)))
            .then((update) => {
                if (!update) {
                    cacheDB.characterSync.put({ CharacterId, lastSync: LastSync ?? 0 })
                }
            })
        )))
        : Promise.resolve({})
    await Promise.all([
        updateLastSync,
        cacheDB.messages.bulkPut(messages)
    ])

    //
    // Push messages to Redux
    //
    dispatch(receiveMessages(messages))
}

export {
    getMessages,
    getMessagesByRoom
} from './selectors'

export default messagesSlice.reducer
