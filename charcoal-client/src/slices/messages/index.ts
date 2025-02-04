import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import cacheDB, { LastSyncType } from '../../cacheDB'
import { Message } from '@tonylb/mtw-interfaces/ts/messages'
import { EphemeraClientMessagePublishMessages } from '@tonylb/mtw-interfaces/ts/ephemera'
import { unique } from '../../lib/lists'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import binarySearch from './binarySearch'

const initialState = {} as Record<string, Message[]>

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        receiveMessages(state: any, action: PayloadAction<Message[]>) {
            action.payload.forEach((message) => {
                if (message.Target && state[message.Target]) {
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
                else if (message.Target) {
                    state[message.Target] = [message]
                }
            })
        },
        clear(state: any) {
            state = {}
        }
    }
})

export const { receiveMessages, clear } = messagesSlice.actions

export const cacheMessages = (payload: EphemeraClientMessagePublishMessages) => async (dispatch: any) => {
    //
    // Update LastSync data, and push messages to cacheDB
    //
    const { messages, LastSync } = payload
    const lastSyncUpdateTargets = unique(messages.map(({ Target }) => (Target))) as EphemeraCharacterId[]
    const updateLastSync = LastSync
        ? Promise.all(lastSyncUpdateTargets.map((CharacterId) => (cacheDB.characterSync
            .where('CharacterId').equals(CharacterId)
            .modify((storedLastSync) => { storedLastSync.lastSync = Math.max(LastSync ?? 0, storedLastSync.lastSync) })
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
