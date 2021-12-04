import { FETCH_MY_CHARACTERS_ATTEMPT, FETCH_MY_CHARACTERS_SUCCESS, RECEIVE_MY_CHARACTER_CHANGE } from '../actions/characters.js'
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
        //
        // TODO:  This has been simplified down to a ridiculous degree by the removal of GRANT_ADD and GRANT_REVOKE.
        // It probably should now be part of some other reducer (like Player) with denormalized handling through
        // the ControlChannel outlet
        //
        case RECEIVE_MY_CHARACTER_CHANGE:
            const previousCharacter = state.data.find(({ CharacterId }) => (CharacterId === payload.CharacterId)) || {}
            let characterData = null
            switch(actionType) {
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