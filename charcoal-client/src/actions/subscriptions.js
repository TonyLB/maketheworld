import { API, graphqlOperation } from 'aws-amplify'
import { addedRoomMessage } from '../graphql/subscriptions'
import { worldMessageAdded } from './messages'

import { getCurrentRoomId } from '../selectors/connection'

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
    Object.values(subscriptions).forEach((subscription) => subscription.unsubscribe())
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
        const newRoomSubscription = API.graphql(graphqlOperation(addedRoomMessage, { RoomId: currentRoomId }))
        .subscribe({
            next: (messageData) => {
                const { value = {} } = messageData
                const { data = {} } = value
                const { addedRoomMessage = {} } = data
                const { Message } = addedRoomMessage
                dispatch(worldMessageAdded(Message))
            }
        })
        dispatch(addSubscription({ currentRoom: newRoomSubscription }))
    }
}