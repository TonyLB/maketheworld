import { Auth, API, graphqlOperation } from 'aws-amplify'
import { getPlayerCharacters } from '../graphql/queries'
import { putCharacter as putCharacterGraphQL } from '../graphql/mutations'
import { changedCharacter } from '../graphql/subscriptions'

import { closeCharacterDialog } from './UI/characterDialog'
import { addSubscription } from './subscriptions'

export const FETCH_CHARACTERS_SUCCESS = 'FETCH_CHARACTERS_SUCCESS'
export const FETCH_CHARACTERS_ATTEMPT = 'FETCH_CHARACTERS_ATTEMPT'
export const PUT_CHARACTER_SUCCESS = 'PUT_CHARACTER_SUCCESS'
export const RECEIVE_CHARACTER_CHANGE = 'RECEIVE_CHARACTER_CHANGE'

export const fetchCharactersAttempt = () => ({
    type: FETCH_CHARACTERS_ATTEMPT
})

export const fetchCharactersSuccess = (payload) => ({
    type: FETCH_CHARACTERS_SUCCESS,
    payload
})

export const fetchCharacters = () => (dispatch, getState) => {
    const { characters } = getState()

    if (!(characters && characters.meta && characters.meta.fetching)){
        dispatch(fetchCharactersAttempt())
        return API.graphql(graphqlOperation(getPlayerCharacters))
            .then(({ data }) => (data || {}))
            .then(({ getPlayerCharacters }) => (getPlayerCharacters || []))
            .then((payload) => (dispatch(fetchCharactersSuccess(payload))))
    }
}

export const putCharacterSuccess = (payload) => ({
    type: PUT_CHARACTER_SUCCESS,
    payload
})

export const putCharacter = ({
    name = '',
    characterId = '',
    pronouns = '',
    firstImpression = '',
    outfit = '',
    oneCoolThing = ''
}) => (dispatch) => {
    return API.graphql(graphqlOperation(putCharacterGraphQL, {
            Name: name,
            ...(characterId ? { CharacterId: characterId ? characterId : null } : {}),
            ...(pronouns ? { Pronouns: pronouns ? pronouns : null } : {}),
            ...(firstImpression ? { FirstImpression: firstImpression ? firstImpression : null } : {}),
            ...(pronouns ? { Outfit: outfit ? outfit : null } : {}),
            ...(oneCoolThing ? { OneCoolThing: oneCoolThing ? oneCoolThing : null } : {})
        }))
        .then((payload) => {
            dispatch(putCharacterSuccess(payload))
        })
}

export const putCharacterAndCloseDialog = (characterData) => (dispatch) => {
    return dispatch(putCharacter(characterData))
        .then(() => {
            dispatch(closeCharacterDialog())
        })
}

export const receiveCharacterChange = (payload) => ({
    type: RECEIVE_CHARACTER_CHANGE,
    payload
})

export const subscribeCharacterChanges = () => (dispatch) => {
    const subscription = API.graphql(graphqlOperation(changedCharacter))
        .subscribe({
            next: (characterData) => {
                const { value = {} } = characterData
                const { data = {} } = value
                const { changedCharacter = {} } = data
                const { PlayerSub } = changedCharacter
                if (PlayerSub) {
                    Auth.currentAuthenticatedUser()
                        .then(({ attributes = {} }) => attributes)
                        .then(({ sub = '' }) => {
                            if (sub === PlayerSub) {
                                dispatch(receiveCharacterChange(changedCharacter))
                            }
                        })
                        .catch()
                }
            }
        })
    return addSubscription({ character: subscription })
}