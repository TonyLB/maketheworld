import { API, graphqlOperation } from 'aws-amplify'
import { worldMessageAdded, playerMessageAdded, announcementAdded, directMessageAdded } from './messages'

import { getCurrentRoomId, getCharacterId } from '../selectors/connection'

export const ADD_SUBSCRIPTION = 'ADD_SUBSCRIPTION'
export const REMOVE_ALL_SUBSCRIPTIONS = 'REMOVE_ALL_SUBSCRIPTIONS'

export const addSubscription = (subscription) => ({
    type: ADD_SUBSCRIPTION,
    subscription
})

export const removeAllSubscriptions = () => ({
    type: REMOVE_ALL_SUBSCRIPTIONS
})

export const unsubscribeAll = () => (dispatch, getState) => {
    const { subscriptions } = getState()
    const { ping, ...rest } = subscriptions || {}
    if (ping) {
        clearInterval(ping)
    }
    Object.values(rest).forEach((subscription) => subscription.unsubscribe())
    dispatch(removeAllSubscriptions())
}

export const moveRoomSubscription = (RoomId) => (dispatch, getState) => {
    const state = getState()
    const { subscriptions } = state
    const { currentRoom } = subscriptions || {}
    if (currentRoom) {
        currentRoom.unsubscribe()
    }
    const currentRoomId = RoomId || getCurrentRoomId(state)
    if (!currentRoomId) {
        console.log('Cannot yet subscribe to room messages')
    }
    else {
        //
        // Unfortunately, as of the writing of this code (April 2020), Amplify's codegen
        // doesn't handle multiply-parametrized subscriptions worth beans, so we need
        // to explicitly create a subscription (and keep it updated if it is ever
        // changed in the schema).  Boo.
        //
        const roomSubscription = `subscription AddedMessage {
            addedMessage(RoomId: "${currentRoomId}") {
              MessageId
              CreatedTime
              Target
              Message
              RoomId
              CharacterId
              FromCharacterId
              ToCharacterId
              Recap
              ExpirationTime
              Type
              Title
            }
          }`
        const newRoomSubscription = API.graphql(graphqlOperation(roomSubscription))
        .subscribe({
            next: (messageData) => {
                const { value = {} } = messageData
                const { data = {} } = value
                const { addedMessage = {} } = data
                const { MessageId, Message, FromCharacterId, Type, Title } = addedMessage || {}
                switch(Type) {
                    case 'ROOM':
                        if (FromCharacterId) {
                            dispatch(playerMessageAdded({ MessageId, Message, CharacterId: FromCharacterId }))
                        }
                        else {
                            dispatch(worldMessageAdded({ MessageId, Message }))
                        }
                        break;
                    case 'ANNOUNCEMENT':
                        dispatch(announcementAdded({ MessageId, Message, Title }))
                        break;
                    default:
                        break;
                }
            }
        })
        dispatch(addSubscription({ currentRoom: newRoomSubscription }))
    }
    return Promise.resolve({})
}

export const directMessageSubscription = () => (dispatch, getState) => {
    const state = getState()
    const { subscriptions } = state
    const { directMessages } = subscriptions || {}
    if (directMessages) {
        directMessages.unsubscribe()
    }
    const CharacterId = getCharacterId(state)
    if (!CharacterId) {
        console.log('Cannot yet subscribe to direct messages')
    }
    else {
        //
        // Unfortunately, as of the writing of this code (April 2020), Amplify's codegen
        // doesn't handle multiply-parametrized subscriptions worth beans, so we need
        // to explicitly create a subscription (and keep it updated if it is ever
        // changed in the schema).  Boo.
        //
        const directSubscription = `subscription AddedMessage {
            addedMessage(CharacterId: "${CharacterId}") {
              MessageId
              CreatedTime
              Target
              Message
              RoomId
              CharacterId
              FromCharacterId
              ToCharacterId
              Recap
              ExpirationTime
              Type
              Title
            }
          }`
        const newDirectMessageSubscription = API.graphql(graphqlOperation(directSubscription))
        .subscribe({
            next: (messageData) => {
                const { value = {} } = messageData
                const { data = {} } = value
                const { addedMessage = {} } = data
                const { Message, FromCharacterId, ToCharacterId, Type } = addedMessage || {}
                switch(Type) {
                    case 'DIRECT':
                        if (FromCharacterId) {
                            dispatch(directMessageAdded({ Message, FromCharacterId, ToCharacterId }))
                        }
                        break;
                    default:
                        break;
                }
            }
        })
        dispatch(addSubscription({ directMessages: newDirectMessageSubscription }))
    }
}