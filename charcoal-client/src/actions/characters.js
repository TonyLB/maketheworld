import { API, graphqlOperation } from 'aws-amplify'
import { getPlayerCharacters, getAllCharacters, getCharactersInPlay, getRoomRecap } from '../graphql/queries'
import {
    putCharacter as putCharacterGraphQL,
    addCharacterInPlay as addCharacterInPlayGraphQL
} from '../graphql/mutations'
import { changedCharactersInPlay } from '../graphql/subscriptions'

import { closeMyCharacterDialog } from './UI/myCharacterDialog'
import { addSubscription, moveRoomSubscription } from './subscriptions'
import { lookRoom } from './behaviors/lookRoom'
import { sendMessage } from './messages'
import { getMyCurrentCharacter } from '../selectors/myCharacters'
import { getMyCharacterInPlay } from '../selectors/connection'
import { getCurrentNeighborhood } from '../selectors/currentRoom'
import charactersInPlayReducer from '../reducers/charactersInPlay'

export const FETCH_MY_CHARACTERS_SUCCESS = 'FETCH_MY_CHARACTERS_SUCCESS'
export const FETCH_MY_CHARACTERS_ATTEMPT = 'FETCH_MY_CHARACTERS_ATTEMPT'
export const PUT_MY_CHARACTER_SUCCESS = 'PUT_MY_CHARACTER_SUCCESS'
export const RECEIVE_MY_CHARACTER_CHANGE = 'RECEIVE_MY_CHARACTER_CHANGE'
export const FETCH_CHARACTERS_IN_PLAY_ATTEMPT = 'FETCH_CHARACTER_IN_PLAY_ATTEMPT'
export const FETCH_CHARACTERS_IN_PLAY_SUCCESS = 'FETCH_CHARACTERS_IN_PLAY_SUCCESS'
export const RECEIVE_CHARACTERS_IN_PLAY_CHANGE = 'RECEIVE_CHARACTERS_IN_PLAY_CHANGE'
export const RECEIVE_CHARACTER_CHANGES = 'RECEIVE_CHARACTER_CHANGES'

export const receiveCharacterChanges = (characterChanges) => ({
    type: RECEIVE_CHARACTER_CHANGES,
    characterChanges
})

export const fetchCharacters = (dispatch) => {
    return API.graphql(graphqlOperation(getAllCharacters))
        .then(({ data }) => (data || {}))
        .then(({ getAllCharacters }) => (getAllCharacters || []))
        .then((characterChanges) => (dispatch(receiveCharacterChanges(characterChanges))))
}

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

export const putMyCharacterSuccess = (payload) => ({
    type: PUT_MY_CHARACTER_SUCCESS,
    payload
})

//
// TODO:  Refactor putCharacter to output updates to characters in subscription, and add character subscriptions
// to the permanents subscription
//
export const putMyCharacter = ({
    name = '',
    characterId = '',
    pronouns = '',
    firstImpression = '',
    outfit = '',
    oneCoolThing = '',
    homeId = ''
}) => (dispatch) => {
    return API.graphql(graphqlOperation(putCharacterGraphQL, {
            Name: name,
            ...(characterId ? { CharacterId: characterId ? characterId : null } : {}),
            ...(pronouns ? { Pronouns: pronouns ? pronouns : null } : {}),
            ...(firstImpression ? { FirstImpression: firstImpression ? firstImpression : null } : {}),
            ...(pronouns ? { Outfit: outfit ? outfit : null } : {}),
            ...(oneCoolThing ? { OneCoolThing: oneCoolThing ? oneCoolThing : null } : {}),
            ...(homeId ? { HomeId: homeId } : {})
        }))
        .then(({ data = {} }) => (data))
        .then(({ putCharacter = {} }) => (putCharacter))
        .then((payload) => {
            dispatch(receiveCharacterChanges([payload.CharacterInfo]))
            dispatch(putMyCharacterSuccess(payload))
        })
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

export const addCharacterInPlay = ({ characterId }) => (dispatch, getState) => {
    return API.graphql(graphqlOperation(addCharacterInPlayGraphQL, {
        CharacterId: characterId,
    }))
}

export const receiveCharactersInPlayChange = (payload) => (dispatch, getState) => {
    const state = getState()
    //
    // Update the store and create a predicted next state
    //
    const action = {
        type: RECEIVE_CHARACTERS_IN_PLAY_CHANGE,
        payload
    }
    dispatch(action)
    const newState = {
        ...state,
        charactersInPlay: charactersInPlayReducer(state.charactersInPlay || {}, action)
    }
    const myCharacter = getMyCharacterInPlay(newState)
    const myCurrentCharacter = getMyCurrentCharacter(newState)
    const myPreviousCharacter = getMyCharacterInPlay(state)
    if (myCharacter.CharacterId === payload.CharacterId) {
        //
        // Handle actions that depend upon changes in the state of your own character.
        //
        const currentNeighborhood = getCurrentNeighborhood(state)
        const previousAncestry = (currentNeighborhood && currentNeighborhood.ancestry)
        if (myCharacter && myCharacter.Connected && myCharacter.RoomId && !(myPreviousCharacter && myPreviousCharacter.Connected && myPreviousCharacter.RoomId === myCharacter.RoomId)) {
            return dispatch(moveRoomSubscription(payload.RoomId))
                .then(() => (API.graphql(graphqlOperation(getRoomRecap, { PermanentId: payload.RoomId }))))
                .then(({ data }) => (data))
                .then(({ getRoomRecap }) => (getRoomRecap))
                .then((Recap) => {
                    dispatch(lookRoom({ RoomId: myCharacter.RoomId, Recap, showNeighborhoods: true, previousAncestry }))
                    const { Name = 'Someone' } = myCurrentCharacter || {}
                    return sendMessage({ RoomId: myCharacter.RoomId, Message: `${Name} has ${(myPreviousCharacter.Connected) ? 'arrived' : 'connected'}.` })
                })
        }
    }
}

export const subscribeCharactersInPlayChanges = () => (dispatch) => {
    const subscription = API.graphql(graphqlOperation(changedCharactersInPlay))
        .subscribe({
            next: (characterData) => {
                const { value = {} } = characterData
                const { data = {} } = value
                const { changedCharactersInPlay = {} } = data
                dispatch(receiveCharactersInPlayChange(changedCharactersInPlay))
            }
        })

    dispatch(addSubscription({ charactersInPlay: subscription }))
    dispatch(fetchCharactersInPlay())
}

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