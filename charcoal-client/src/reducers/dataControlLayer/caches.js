import { DCL_FSM_INITIAL, DCL_FSM_SYNCHRONIZED, DCL_FSM_SYNCHRONIZNG } from '../../actions/dataControlLayer'

const initialState = (rootLevelKeys) => ({
    ...Object.assign({}, ...rootLevelKeys.map(key => ({ [key]: { status: DCL_FSM_INITIAL } })))
})

export const reducer = (state = initialState(['permanents', 'ephemera', 'messages']), action = {}) => {
    return state
}

export default reducer