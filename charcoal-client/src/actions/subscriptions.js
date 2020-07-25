import { API, graphqlOperation } from 'aws-amplify'
import { addedMessage } from '../graphql/subscriptions'
import { receiveMessage } from './messages'

import { getCharacterId } from '../selectors/connection'

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

export const messageSubscription = () => (dispatch, getState) => {
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
        const newMessageSubscription = API.graphql(graphqlOperation(addedMessage, { Target: `${CharacterId}` }))
            .subscribe({
                next: (messageData) => {
                    const { value = {} } = messageData
                    const { data = {} } = value
                    const { addedMessage = {} } = data
                    dispatch(receiveMessage(addedMessage))
                }
            })
        dispatch(addSubscription({ messages: newMessageSubscription }))
    }
}