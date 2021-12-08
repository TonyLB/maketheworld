// import { API, graphqlOperation } from 'aws-amplify'
// import { addedMessage } from '../../graphql/subscriptions'
// import { receiveMessage } from '../messages'

//
// subscribe manages the subscription itself
//
export const subscribeAction = ({ CharacterId }) => async (dispatch) => {
    // const newMessageSubscription = await API.graphql(graphqlOperation(addedMessage, { Target: CharacterId }))
    //     .subscribe({
    //         next: (messageData) => {
    //             //
    //             // TODO:  Confirm that WebSocket communications protocol has picked up the lift for
    //             // messageSubscribe, and then remove this stage from connection.
    //             //
    //             // dispatch(receiveMessage(messageData.value?.data?.addedMessage ?? {}))
    //         }
    //     })
    // return { subscription: newMessageSubscription }
    return {}
}