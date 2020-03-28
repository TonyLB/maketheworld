export const ACTIVATE_ROOM_DIALOG = 'ACTIVATE_ROOM_DIALOG'
export const CLOSE_ROOM_DIALOG = 'CLOSE_ROOM_DIALOG'

export const activateRoomDialog = ({
    roomId = '',
    name = '',
    description = '',
    ancestry = '',
    parentId = '',
    parentName = '',
    exits = [],
    entries = [],
    nested = false
}) => ({
    type: ACTIVATE_ROOM_DIALOG,
    roomId,
    name,
    description,
    ancestry,
    parentId,
    parentName,
    exits,
    entries,
    nested
})

export const closeRoomDialog = () => ({ type: CLOSE_ROOM_DIALOG })
