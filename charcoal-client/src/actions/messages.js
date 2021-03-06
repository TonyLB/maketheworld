import { API, graphqlOperation } from 'aws-amplify'
import { updateMessages } from '../graphql/mutations'
import { syncMessages as syncMessagesGQL } from '../graphql/queries'
import { addedMessage } from '../graphql/subscriptions'
import { v4 as uuidv4 } from 'uuid'

import { getActiveCharactersInRoom } from '../selectors/charactersInPlay'
import cacheDB from '../cacheDB'
import { deltaFactory } from './deltaSync'
import { addSubscription } from './subscriptions'

export const RECEIVE_MESSAGES = 'RECEIVE_MESSAGES'
export const SET_MESSAGE_OPEN = 'SET_MESSAGE_OPEN'

export const receiveMessages = (messages) => async (dispatch) => {
    await cacheDB.messages.bulkPut(messages)
    dispatch({
        type: RECEIVE_MESSAGES,
        payload: messages
    })
}

export const receiveMessage = ({ MessageId, ...message }) => (
    receiveMessages([{
        MessageId: MessageId || uuidv4(),
        ...message
    }])
)

export const setMessageOpen = ({ MessageId, open }) => ({
    type: SET_MESSAGE_OPEN,
    payload: {
        MessageId,
        open
    }
})

export const sendWorldMessage = ({RoomId = null, Message, Characters = []}) => (dispatch, getState) => {
    const state = getState()
    const roomCharacters = (RoomId && getActiveCharactersInRoom({ RoomId })(state).map(({ CharacterId }) => (CharacterId))) || []
    if (Message) {
        return API.graphql(graphqlOperation(updateMessages, { Updates: [{ putMessage: {
            RoomId,
            Characters: [...(new Set([ ...Characters, ...roomCharacters ]))],
            MessageId: uuidv4(),
            DisplayProtocol: "World",
            WorldMessage: {
                Message
            }
        }}]}))
        .catch((err) => { console.log(err)})
    }
    return Promise.resolve({})
}

export const sendPlayerMessage = ({RoomId = null, Message, CharacterId, Characters = []}) => (dispatch, getState) => {
    const state = getState()
    console.log(`RoomId: ${RoomId}`)
    const roomCharacters = (RoomId && getActiveCharactersInRoom({ RoomId })(state).map(({ CharacterId }) => (CharacterId))) || []
    console.log(roomCharacters)
    if (Message) {
        return API.graphql(graphqlOperation(updateMessages, { Updates: [{ putMessage: {
            RoomId,
            Characters: [...(new Set([ ...Characters, ...roomCharacters ]))],
            MessageId: uuidv4(),
            DisplayProtocol: "Player",
            CharacterMessage: {
                CharacterId,
                Message
            }
        }}]}))
        .catch((err) => { console.log(err)})
    }
    return Promise.resolve({})
}

export const sendDirectMessage = ({Message, CharacterId, Characters = [], Recipients = []}) => (dispatch, getState) => {
    if (Message) {
        return API.graphql(graphqlOperation(updateMessages, { Updates: [{ putMessage: {
            RoomId: null,
            Characters,
            MessageId: uuidv4(),
            DisplayProtocol: "Direct",
            DirectMessage: {
                CharacterId,
                Message,
                Recipients
            }
        }}]}))
        .catch((err) => { console.log(err)})
    }
    return Promise.resolve({})
}

export const fetchCachedMessages = (CharacterId) => async (dispatch) => {

    const messages = await cacheDB.messages.where("Target").equals(CharacterId).toArray()

    dispatch({
        type: RECEIVE_MESSAGES,
        payload: messages
    })
}

export const subscribeMessageChanges = (CharacterId) => async (dispatch, getState) => {
    if (!CharacterId) {
        console.log('Cannot yet subscribe to direct messages')
    }
    else {
        const state = getState()
        const lastMessageSyncKey = `LastMessageSync-${CharacterId}`
        const { syncFromDelta: syncFromMessagesDelta, syncFromBaseTable: syncFromMessages } = deltaFactory({
            dataTag: 'syncMessages',
            lastSyncCallback: (value) => {
                cacheDB.clientSettings.put({ key: lastMessageSyncKey, value })
            },
            processingAction: receiveMessages,
            syncGQL: syncMessagesGQL,
        })
        const { subscriptions } = state
        const { directMessages } = subscriptions || {}
        if (directMessages) {
            directMessages.unsubscribe()
        }
        dispatch(fetchCachedMessages(CharacterId))
        const { value: LastMessageSync } = await cacheDB.clientSettings.get(lastMessageSyncKey) || {}
        const newMessageSubscription = await API.graphql(graphqlOperation(addedMessage, { Target: CharacterId }))
            .subscribe({
                next: (messageData) => {
                    const { value = {} } = messageData
                    const { data = {} } = value
                    const { addedMessage = {} } = data
                    dispatch(receiveMessage(addedMessage))
                }
            })

        dispatch(addSubscription({ messages: newMessageSubscription }))
        if (LastMessageSync) {
            dispatch(syncFromMessagesDelta({ targetId: CharacterId, startingAt: LastMessageSync - 30000 }))
        }
        else {
            dispatch(syncFromMessages({ targetId: CharacterId }))
        }

    }

}
