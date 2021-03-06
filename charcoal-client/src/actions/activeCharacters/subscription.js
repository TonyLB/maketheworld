import { API, graphqlOperation } from 'aws-amplify'
import { addedMessage } from '../../graphql/subscriptions'
import { receiveMessage } from '../messages'

//
// subscribe manages the subscription itself
//
export const subscribe = (CharacterId) => async (dispatch) => {
    const newMessageSubscription = await API.graphql(graphqlOperation(addedMessage, { Target: CharacterId }))
        .subscribe({
            next: (messageData) => {
                dispatch(receiveMessage(messageData.value?.data?.addedMessage ?? {}))
            }
        })
    return newMessageSubscription
}