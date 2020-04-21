import { ACTIVATE_DIRECT_MESSAGE_DIALOG, CLOSE_DIRECT_MESSAGE_DIALOG } from '../../actions/UI/directMessageDialog'

export const reducer = (state = '', action = {}) => {
    const {
        type,
        ToCharacterId = ''
    } = action

    switch (type) {

        case CLOSE_DIRECT_MESSAGE_DIALOG:
            return ''
        case ACTIVATE_DIRECT_MESSAGE_DIALOG:
            return ToCharacterId
        default:
            return state
    }
}

export default reducer