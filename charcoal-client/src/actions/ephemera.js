import { API, graphqlOperation } from 'aws-amplify'
import { getRoomRecap } from '../graphql/queries'
import { changedEphemera } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'
import { lookRoom } from './behaviors/lookRoom'
import { sendWorldMessage } from './messages'
import { getMyCurrentCharacter } from '../selectors/myCharacters'
import { getMyCharacterInPlay } from '../selectors/connection'
import { getCurrentNeighborhood } from '../selectors/currentRoom'
import charactersInPlayReducer from '../reducers/charactersInPlay'
import { fetchCharactersInPlay } from './characters'

export const RECEIVE_EPHEMERA_CHANGE = 'RECEIVE_EPHEMERA_CHANGE'

// export const receiveEphemeraChange = (payload) => (dispatch, getState) => {
//     const state = getState()
//     //
//     // Update the store and create a predicted next state
//     //
//     const action = {
//         type: RECEIVE_EPHEMERA_CHANGE,
//         payload
//     }
//     dispatch(action)
//     const newState = {
//         ...state,
//         charactersInPlay: charactersInPlayReducer(state.charactersInPlay || {}, action)
//     }
//     const myCharacter = getMyCharacterInPlay(newState)
//     const myCurrentCharacter = getMyCurrentCharacter(newState)
//     const myPreviousCharacter = getMyCharacterInPlay(state)
//     if (myCharacter.CharacterId === payload.CharacterId) {
//         //
//         // Handle actions that depend upon changes in the state of your own character.
//         //
//         const currentNeighborhood = getCurrentNeighborhood(state)
//         const previousAncestry = (currentNeighborhood && currentNeighborhood.ancestry)
//         if (myCharacter && myCharacter.Connected && myCharacter.RoomId && !(myPreviousCharacter && myPreviousCharacter.Connected && myPreviousCharacter.RoomId === myCharacter.RoomId)) {
//             return API.graphql(graphqlOperation(getRoomRecap, { PermanentId: payload.RoomId }))
//                 .then(({ data }) => (data))
//                 .then(({ getRoomRecap }) => (getRoomRecap))
//                 .then((Recap) => {
//                     dispatch(lookRoom({ RoomId: myCharacter.RoomId, Recap, showNeighborhoods: true, previousAncestry }))
//                     const { Name = 'Someone' } = myCurrentCharacter || {}
//                     dispatch(sendWorldMessage({ RoomId: myCharacter.RoomId, Message: `${Name} has ${(myPreviousCharacter.Connected) ? 'arrived' : 'connected'}.` }))
//                 })
//         }
//     }
// }

// export const subscribeEphemeraChanges = (dispatch) => {
//     const subscription = API.graphql(graphqlOperation(changedEphemera))
//         .subscribe({
//             next: (ephemeraData) => {
//                 const { value = {} } = ephemeraData
//                 const { data = {} } = value
//                 const { changedEphemera = [] } = data
//                 dispatch(receiveEphemeraChange(changedEphemera))
//             }
//         })

//     dispatch(addSubscription({ ephemera: subscription }))
//     dispatch(fetchCharactersInPlay())
// }
