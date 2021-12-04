import { Auth, API, graphqlOperation } from 'aws-amplify'
import { v4 as uuidv4 } from 'uuid'

import { getPlayerCharacters } from '../graphql/queries'

import { closeMyCharacterDialog } from './UI/myCharacterDialog'
import { getMyCurrentCharacter } from '../selectors/myCharacters'
import { getPlayer } from '../selectors/player'
import { socketDispatchPromise } from './communicationsLayer/lifeLine'

export const FETCH_MY_CHARACTERS_SUCCESS = 'FETCH_MY_CHARACTERS_SUCCESS'
export const FETCH_MY_CHARACTERS_ATTEMPT = 'FETCH_MY_CHARACTERS_ATTEMPT'
export const RECEIVE_MY_CHARACTER_CHANGE = 'RECEIVE_MY_CHARACTER_CHANGE'
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

//
// TODO: putMyCharacter function has not yet been QA-tested in the web-client.  When
// a screen for updating character assets is live again, test.
//
export const putMyCharacter = ({
    name = '',
    characterId = '',
    pronouns = '',
    firstImpression = '',
    outfit = '',
    oneCoolThing = '',
    homeId = ''
}) => async (dispatch, getState) => {
    const finalCharacterId = characterId || uuidv4()
    const { username } = await Auth.currentAuthenticatedUser()
    return dispatch(socketDispatchPromise('putCharacter')({
        Name: name,
        CharacterId: finalCharacterId,
        Player: username,
        ...(pronouns ? { Pronouns: pronouns ? pronouns : null } : {}),
        ...(firstImpression ? { FirstImpression: firstImpression ? firstImpression : null } : {}),
        ...(pronouns ? { Outfit: outfit ? outfit : null } : {}),
        ...(oneCoolThing ? { OneCoolThing: oneCoolThing ? oneCoolThing : null } : {}),
        ...(homeId ? { HomeId: homeId } : {})
    }))
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