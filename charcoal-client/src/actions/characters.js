import { API, graphqlOperation } from 'aws-amplify'
import { getPlayerCharacters } from '../graphql/queries'

export const FETCH_CHARACTERS_SUCCESS = 'FETCH_CHARACTERS_SUCCESS'
export const FETCH_CHARACTERS_ATTEMPT = 'FETCH_CHARACTERS_ATTEMPT'

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
