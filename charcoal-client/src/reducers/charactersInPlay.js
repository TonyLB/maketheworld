import { RECEIVE_EPHEMERA_CHANGE } from '../actions/communicationsLayer/appSyncSubscriptions/ephemeraSubscription'

const colorSequence = ['pink', 'purple', 'green']
    .map(color => ({
        primary: color,
        light: `light${color}`,
        recap: `recap${color}`,
        recapLight: `recapLight${color}`,
        direct: `direct${color}`
    }))

const ephemeraMergeReducer = (state, { type, ...rest }) => {
    switch(type) {
        case 'CharacterInPlay':
            const { CharacterId, RoomId, Connected, Name } = rest
            const nextColorIndex = (Object.values(state).length + 2) % 3
            return {
                ...state,
                [CharacterId]: {
                    CharacterId,
                    RoomId,
                    Connected,
                    Name,
                    color: (state && state[CharacterId] && state[CharacterId].color) || colorSequence[nextColorIndex]
                }
            }
        default:
            return state
    }
}

export const reducer = (state = '', action = {}) => {
    const { type: actionType = "NOOP", payload = '' } = action
    switch (actionType) {
        case RECEIVE_EPHEMERA_CHANGE:
            return (payload || []).reduce(ephemeraMergeReducer, state)
        default: return state
    }
}

export default reducer