// import { syncMessages as syncMessagesGQL } from '../graphql/queries'
import { v4 as uuidv4 } from 'uuid'
import { socketDispatch } from '../slices/lifeLine'

import cacheDB from '../cacheDB'
// import { deltaFactory } from './deltaSync'
// import { addSubscription } from './subscriptions'

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

export const sendDirectMessage = ({Message, CharacterId, Characters = [], Recipients = []}) => async (dispatch, getState) => {
    if (Message) {
        dispatch(socketDispatch('directMessage')({
            CharacterId,
            Targets: Characters.map((characterId) => (`CHARACTER#${characterId}`)),
            Recipients,
            Message
        }))
    }
    return {}
}

export const fetchCachedMessages = (CharacterId) => async (dispatch) => {

    const messages = await cacheDB.messages.where("Target").equals(CharacterId).toArray()

    dispatch({
        type: RECEIVE_MESSAGES,
        payload: messages
    })
}
