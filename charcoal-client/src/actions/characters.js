import { API, graphqlOperation } from 'aws-amplify'
import { v4 as uuidv4 } from 'uuid'

import { getPlayerCharacters, getCharactersInPlay, getRoomRecap } from '../graphql/queries'
import {
    putPlayer as putPlayerGraphQL,
    updatePermanents
} from '../graphql/mutations'

import { closeMyCharacterDialog } from './UI/myCharacterDialog'
import { lookRoom } from './behaviors/lookRoom'
import { sendWorldMessage } from './messages'
import { getMyCurrentCharacter } from '../selectors/myCharacters'
import { getMyCharacterInPlay } from '../selectors/connection'
import { getCurrentNeighborhood } from '../selectors/currentRoom'
import { getPlayer } from '../selectors/player'
import charactersInPlayReducer from '../reducers/charactersInPlay'

export const FETCH_MY_CHARACTERS_SUCCESS = 'FETCH_MY_CHARACTERS_SUCCESS'
export const FETCH_MY_CHARACTERS_ATTEMPT = 'FETCH_MY_CHARACTERS_ATTEMPT'
export const RECEIVE_MY_CHARACTER_CHANGE = 'RECEIVE_MY_CHARACTER_CHANGE'
export const FETCH_CHARACTERS_IN_PLAY_ATTEMPT = 'FETCH_CHARACTER_IN_PLAY_ATTEMPT'
export const FETCH_CHARACTERS_IN_PLAY_SUCCESS = 'FETCH_CHARACTERS_IN_PLAY_SUCCESS'
export const RECEIVE_CHARACTERS_IN_PLAY_CHANGE = 'RECEIVE_CHARACTERS_IN_PLAY_CHANGE'
export const RECEIVE_CHARACTER_CHANGES = 'RECEIVE_CHARACTER_CHANGES'

export const receiveCharacterChanges = (characterChanges) => ({
    type: RECEIVE_CHARACTER_CHANGES,
    characterChanges
})

export const fetchMyCharactersAttempt = () => ({
    type: FETCH_MY_CHARACTERS_ATTEMPT
})

export const fetchMyCharactersSuccess = (payload) => ({
    type: FETCH_MY_CHARACTERS_SUCCESS,
    payload
})

export const fetchMyCharacters = () => (dispatch, getState) => {
    const { myCharacters } = getState()

    if (!(myCharacters && myCharacters.meta && myCharacters.meta.fetching)){
        dispatch(fetchMyCharactersAttempt())
        return API.graphql(graphqlOperation(getPlayerCharacters))
            .then(({ data }) => (data || {}))
            .then(({ getPlayerCharacters }) => (getPlayerCharacters || []))
            .then((payload) => (dispatch(fetchMyCharactersSuccess(payload))))
    }
}

export const putMyCharacter = ({
    name = '',
    characterId = '',
    pronouns = '',
    firstImpression = '',
    outfit = '',
    oneCoolThing = '',
    homeId = ''
}) => (dispatch, getState) => {
    const state = getState()
    const player = getPlayer(state)
    const finalCharacterId = characterId || uuidv4()
    const newCharacter = !(player.Characters || []).includes(finalCharacterId)
    return Promise.all([
        API.graphql(graphqlOperation(updatePermanents, { Updates: [
            {
                putCharacter:
                    {
                        Name: name,
                        CharacterId: finalCharacterId,
                        ...(pronouns ? { Pronouns: pronouns ? pronouns : null } : {}),
                        ...(firstImpression ? { FirstImpression: firstImpression ? firstImpression : null } : {}),
                        ...(pronouns ? { Outfit: outfit ? outfit : null } : {}),
                        ...(oneCoolThing ? { OneCoolThing: oneCoolThing ? oneCoolThing : null } : {}),
                        ...(homeId ? { HomeId: homeId } : {})
                    }
            }
        ]})),
        //
        // For a new character, update player list and set beginning grant
        //
        ...(newCharacter
            ? [
                API.graphql(graphqlOperation(putPlayerGraphQL, {
                    ...player,
                    Characters: [
                        ...(player.Characters || []),
                        finalCharacterId
                    ]
                })),
                API.graphql(graphqlOperation(updatePermanents, { Updates: [
                    {
                        putGrant: {
                            CharacterId: finalCharacterId,
                            Resource: 'MINIMUM',
                            Roles: 'PLAYER',
                            Actions: ''
                        }
                    }
                ]})),
            ]
            : []
        )
    ])
}

export const putMyCharacterAndCloseDialog = (characterData) => (dispatch) => {
    return dispatch(putMyCharacter(characterData))
        .then(() => {
            dispatch(closeMyCharacterDialog())
        })
}

export const receiveMyCharacterChange = (payload) => ({
    type: RECEIVE_MY_CHARACTER_CHANGE,
    payload
})

export const fetchCharactersInPlayAttempt = () => ({
    type: FETCH_CHARACTERS_IN_PLAY_ATTEMPT
})

export const fetchCharactersInPlaySuccess = (payload) => ({
    type: FETCH_CHARACTERS_IN_PLAY_SUCCESS,
    payload
})

//
// TODO:  Rework fetchCharactersInPlay to send a websocket message in
// parallel (for the moment) with the graphQL operation.  This will
// require changing the timing on which fetchCharactersInPlay gets
// called to occur after the connection of the LifeLine.
//
export const fetchCharactersInPlay = () => (dispatch, getState) => {
    const { characters } = getState()

    if (!(characters && characters.meta && characters.meta.fetching)){
        dispatch(fetchCharactersInPlayAttempt())
        return API.graphql(graphqlOperation(getCharactersInPlay))
            .then(({ data }) => (data || {}))
            .then(({ getCharactersInPlay }) => (getCharactersInPlay || []))
            .then((payload) => (dispatch(fetchCharactersInPlaySuccess(payload))))
    }
}

// export const receiveCharactersInPlayChange = (payload) => (dispatch, getState) => {
//     const state = getState()
//     //
//     // Update the store and create a predicted next state
//     //
//     const action = {
//         type: RECEIVE_CHARACTERS_IN_PLAY_CHANGE,
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

// export const subscribeCharactersInPlayChanges = () => (dispatch) => {
//     const subscription = API.graphql(graphqlOperation(changedCharactersInPlay))
//         .subscribe({
//             next: (characterData) => {
//                 const { value = {} } = characterData
//                 const { data = {} } = value
//                 const { changedCharactersInPlay = {} } = data
//                 dispatch(receiveCharactersInPlayChange(changedCharactersInPlay))
//             }
//         })

//     dispatch(addSubscription({ charactersInPlay: subscription }))
//     dispatch(fetchCharactersInPlay())
// }

export const setCurrentCharacterHome = (HomeId) => (dispatch, getState) => {
    const state = getState()
    const currentCharacter = getMyCurrentCharacter(state)
    dispatch(putMyCharacter({
        name: currentCharacter.Name,
        characterId: currentCharacter.CharacterId,
        pronouns: currentCharacter.Pronouns,
        firstImpression: currentCharacter.FirstImpression,
        outfit: currentCharacter.Outfit,
        oneCoolThing: currentCharacter.OneCoolThing,
        homeId: HomeId
    }))

}