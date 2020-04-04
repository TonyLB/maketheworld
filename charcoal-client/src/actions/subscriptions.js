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