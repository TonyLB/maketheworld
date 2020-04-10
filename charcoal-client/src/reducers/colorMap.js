import { RECEIVE_MESSAGE } from '../actions/messages.js'
import { SET_NAME } from '../actions/registeredCharacter.js'

const colorSequence = ['pink', 'purple', 'green']
    .map(color => ({
        primary: color,
        light: `light${color}`
    }))

export const reducer = (state = {}, action) => {
    const { type: actionType = 'NOOP', payload = {} } = action || {}
    const { name } = payload
    switch (actionType) {
        case SET_NAME:
            return {
                ...state,
                [payload]: {
                    primary: 'blue',
                    light: 'lightblue'
                }
            }
        case RECEIVE_MESSAGE:
            const { protocol } = payload
            const startingIndex = Object.values(state).filter(({ primary }) => (primary !== 'blue')).length % 3
            if (protocol === 'playerMessage' && name && !(state[name])) {
                return {
                    ...state,
                    [name]: colorSequence[startingIndex]
                }
            }
            else if (protocol === 'roomDescription') {
                const { players=[] } = payload
                const unmappedPlayers = players.map(({ name }) => name)
                    .filter((player) => (!state[player]))
                const newMappings = unmappedPlayers
                    .map((player, index) => ({ [player]: colorSequence[(startingIndex + index) % 3]}))
                    .reduce((previous, item) => ({ ...previous, ...item }), {})
                return {
                    ...state,
                    ...newMappings
                }
            }
            else {
                return state
            }
        default: return state
    }
}

export default reducer