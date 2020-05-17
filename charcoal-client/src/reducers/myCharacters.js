import { FETCH_MY_CHARACTERS_ATTEMPT, FETCH_MY_CHARACTERS_SUCCESS, RECEIVE_MY_CHARACTER_CHANGE } from '../actions/characters.js'
import { GRANT_UPDATE, GRANT_REVOKE } from '../actions/player'

export const reducer = (state = '', action = {}) => {
    const { type: actionType = "NOOP", payload = '' } = action
    switch (actionType) {
        case FETCH_MY_CHARACTERS_ATTEMPT:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: true,
                    fetched: false
                }
            }
        case FETCH_MY_CHARACTERS_SUCCESS:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: false,
                    fetched: true
                },
                data: payload
            }
        case RECEIVE_MY_CHARACTER_CHANGE:
        case GRANT_REVOKE:
        case GRANT_UPDATE:
            const previousCharacter = state.data.find(({ CharacterId }) => (CharacterId === payload.CharacterId)) || {}
            let characterData = null
            switch(actionType) {
                case GRANT_REVOKE:
                    characterData = {
                        ...previousCharacter,
                        Grants: (previousCharacter.Grants || []).filter(({ Resource }) => (Resource !== payload.Resource))
                    }
                    break
                case GRANT_UPDATE:
                    characterData = {
                        ...previousCharacter,
                        Grants: [
                            ...(previousCharacter.Grants || []).filter(({ Resource }) => (Resource !== payload.Resource)),
                            payload
                        ]
                    }
                    break
                case RECEIVE_MY_CHARACTER_CHANGE:
                    characterData = payload
                    break
                default:
            }
            if (!characterData) {
                return state
            }
            return {
                ...state,
                data: [
                    ...state.data.filter(({ CharacterId }) => (CharacterId !== payload.CharacterId)),
                    characterData
                ].sort(({ Name: nameA }, { Name: nameB }) => (nameA.localeCompare(nameB)))
            }
        default: return state
    }
}

export default reducer