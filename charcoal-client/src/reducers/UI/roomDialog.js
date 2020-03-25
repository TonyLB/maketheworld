import { ACTIVATE_ROOM_DIALOG, CLOSE_ROOM_DIALOG } from '../../actions/UI/roomDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type,
        roomId = '',
        name = '',
        description = '',
        neighborhood = '',
        exits = [],
        entries = []
    } = action
    
    switch (type) {

        case CLOSE_ROOM_DIALOG:
            return {
                ...state,
                open: false
            }
        case ACTIVATE_ROOM_DIALOG:
            return {
                open: true,
                roomId,
                name,
                description,
                neighborhood,
                exits,
                entries
            }
        default:
            return state
    }
}

export default reducer