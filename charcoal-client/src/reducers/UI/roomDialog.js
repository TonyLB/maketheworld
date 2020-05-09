import { ACTIVATE_ROOM_DIALOG, CLOSE_ROOM_DIALOG } from '../../actions/UI/roomDialog'

export const reducer = (state = { open: false }, action) => {
    const {
        type,
        RoomId = '',
        Name = '',
        Description = '',
        Ancestry = '',
        ParentId = '',
        parentName = '',
        parentAncestry = '',
        Exits = [],
        Entries = [],
        nested = false
    } = action
    
    switch (type) {

        case CLOSE_ROOM_DIALOG:
            return {
                ...state,
                open: false,
                nestedOpen: false
            }
        case ACTIVATE_ROOM_DIALOG:
            return {
                open: !nested,
                nestedOpen: nested,
                RoomId,
                Name,
                Description,
                Ancestry,
                ParentId,
                parentName,
                parentAncestry,
                Exits,
                Entries
            }
        default:
            return state
    }
}

export default reducer