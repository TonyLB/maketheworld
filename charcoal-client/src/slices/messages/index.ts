import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import cacheDB, { LastSyncType } from '../../cacheDB'
import { Message, PerceptionMessage } from '@tonylb/mtw-interfaces/ts/messages'
import { EphemeraClientMessagePublishMessages } from '@tonylb/mtw-interfaces/ts/ephemera'
import { unique } from '../../lib/lists'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import binarySearch from './binarySearch'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { splitType } from '@tonylb/mtw-utilities/ts/types'

// Enhanced message type with parsed WML
type EnhancedMessage = Message | (PerceptionMessage & { parsedWML: StandardForm })

const initialState = {} as Record<string, EnhancedMessage[]>

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        receiveMessages(state: any, action: PayloadAction<EnhancedMessage[]>) {
            action.payload.forEach((rawMessage) => {
                // Process the message with WML parsing if needed
                const message = processPerceptionMessage(rawMessage)
                
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

// Helper function to process PerceptionMessage with WML parsing
const processPerceptionMessage = (message: Message): EnhancedMessage => {
    if (message.DisplayProtocol === 'PerceptionMessage') {
        try {
            const standardForm = new StandardForm(message.wmlContent)
            return {
                ...message,
                parsedWML: standardForm
            }
        } catch (error) {
            console.warn('Failed to parse WML content for PerceptionMessage:', error)
            // Create a fallback StandardForm to prevent perpetual loading state
            const componentUUID = message.metaData.componentUUID
            const [upperTag] = splitType(componentUUID)
            const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
            
            // Create a proper fallback StandardForm with the correct component type
            const fallbackForm = new StandardForm('fallback')
            const defaultData = defaultComponentFromTag(tag as any, 'fallback', componentUUID)
            const fallbackComponent = standardComponentFactory(defaultData)
            
            if (fallbackComponent) {
                fallbackForm._components = [fallbackComponent]
            }
            
            return {
                ...message,
                parsedWML: fallbackForm
            }
        }
    }
    return message
}

export const cacheMessages = (payload: EphemeraClientMessagePublishMessages) => async (dispatch: any) => {
    //
    // Update LastSync data, and push messages to cacheDB
    //
    const { messages, LastSync } = payload
    
    // Store original messages in cacheDB (without parsedWML)
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
        cacheDB.messages.bulkPut(messages) // Store original messages
    ])

    //
    // Push processed messages to Redux
    //
    const processedMessages = messages.map(processPerceptionMessage)
    dispatch(receiveMessages(processedMessages))
}

export {
    getMessages,
    getMessagesByRoom
} from './selectors'

export default messagesSlice.reducer
