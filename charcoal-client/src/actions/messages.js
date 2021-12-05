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

//
// Refactor DirectMessages to work through the controlChannel, then remove Announce and Shout (until
// better structures are in place for such messaging), and you should be able to remove updateMessages
// and the message Subscription from AppSync (leaving only message Sync)
//
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
