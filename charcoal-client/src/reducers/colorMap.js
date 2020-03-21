import { RECEIVE_MESSAGE } from '../actions/messages.js'

const colorSequence = ['blue', 'pink', 'purple', 'green']
    .map(color => ({
        primary: color,
        light: `light${color}`
    }))

export const reducer = (state = {}, action) => {
    const { type: actionType = 'NOOP', payload = {} } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGE:
            const { name = '', protocol } = payload
            if (protocol === 'playerMessage' && name && !(state[name])) {
                return {
                    ...state,
                    [name]: colorSequence[Object.keys(state).length % 4]
                }
            }
            else {
                return state
            }
        default: return state
    }
}

export default reducer