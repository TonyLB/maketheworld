import { Auth, API, graphqlOperation } from 'aws-amplify'
import { getPlayer } from '../graphql/queries'
import { putPlayer as putPlayerQL } from '../graphql/mutations'
import { changedPlayer } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'
import { receiveMyCharacterChange } from './characters'

export const PLAYER_UPDATE = 'PLAYER_UPDATE'
export const GRANT_UPDATE = 'GRANT_UPDATE'
export const GRANT_REVOKE = 'GRANT_REVOKE'

export const playerUpdate = (playerData) => ({
    type: PLAYER_UPDATE,
    data: playerData
})

export const grantUpdate = (grantData) => ({
    type: GRANT_UPDATE,
    payload: grantData
})

export const grantRevoke = (grantData) => ({
    type: GRANT_REVOKE,
    payload: grantData
})

export const fetchPlayer = (username) => (dispatch) => {
    return API.graphql(graphqlOperation(getPlayer, { PlayerName: username }))
        .then(({ data }) => (data || {}))
        .then(({ getPlayer }) => (getPlayer || { PlayerName: username }))
        .then(response => dispatch(playerUpdate(response)))
        .catch((err) => { console.log(err)})
}

export const putPlayer = ({ CodeOfConductConsent, Characters }) => () => {
    return API.graphql(graphqlOperation(putPlayerQL, {
        CodeOfConductConsent,
        Characters
    }))
    .catch((err) => { console.log(err)})    
}

export const subscribePlayerChanges = () => (dispatch) => {
    Auth.currentAuthenticatedUser()
        .then(({ username = '' }) => {
            const playerSubscription = API.graphql(graphqlOperation(changedPlayer, { PlayerName: username}))
            .subscribe({
                next: (message) => {
                    const { value = {} } = message
                    const { data = {} } = value
                    const { changedPlayer = {} } = data
                    const { Type, PlayerInfo, CharacterInfo, GrantInfo } = changedPlayer
                    if (PlayerInfo) {
                        dispatch(playerUpdate(PlayerInfo))
                    }
                    if (CharacterInfo) {
                        dispatch(receiveMyCharacterChange(CharacterInfo))
                    }
                    if (GrantInfo) {
                        switch(Type) {
                            case 'GRANT':
                                dispatch(grantUpdate(GrantInfo))
                                break;
                            case 'REVOKE':
                                dispatch(grantRevoke(GrantInfo))
                                break;
                            default:
                        }
                    }
                }
            })

            dispatch(addSubscription({ player: playerSubscription }))
            dispatch(fetchPlayer(username))
            // dispatch(fetchMyCharacters())
        
        })

}
