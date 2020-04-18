import { Auth, API, graphqlOperation } from 'aws-amplify'
import { getPlayer } from '../graphql/queries'
import { putPlayer as putPlayerQL } from '../graphql/mutations'
import { changedPlayer } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'

export const PLAYER_UPDATE = 'PLAYER_UPDATE'

export const playerUpdate = (playerData) => ({
    type: PLAYER_UPDATE,
    data: playerData
})

export const fetchPlayer = (username) => (dispatch) => {
    return API.graphql(graphqlOperation(getPlayer, { PlayerName: username }))
        .then(({ data }) => (data || {}))
        .then(({ getPlayer }) => (getPlayer || { PlayerName: username }))
        .then(response => dispatch(playerUpdate(response)))
        .catch((err) => { console.log(err)})
}

export const putPlayer = ({ CodeOfConductConsent }) => () => {
    return API.graphql(graphqlOperation(putPlayerQL, {
        CodeOfConductConsent
    }))
    .catch((err) => { console.log(err)})    
}

export const subscribePlayerChanges = () => (dispatch) => {
    Auth.currentAuthenticatedUser()
        .then(({ username = '' }) => {
            const playerSubscription = API.graphql(graphqlOperation(changedPlayer, { PlayerName: username}))
            .subscribe({
                next: (message) => {
                    console.log(`Subscription event`)
                    console.log(message)
                    const { value = {} } = message
                    const { data = {} } = value
                    const { changedPlayer = {} } = data
                    const { PlayerName, CodeOfConductConsent } = changedPlayer
                    dispatch(playerUpdate({ PlayerName, CodeOfConductConsent }))
                }
            })

            dispatch(addSubscription({ player: playerSubscription }))
            dispatch(fetchPlayer(username))
        
        })

}
