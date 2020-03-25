export const ACTIVATE_ROOM_DIALOG = 'ACTIVATE_ROOM_DIALOG'
export const CLOSE_ROOM_DIALOG = 'CLOSE_ROOM_DIALOG'

export const activateRoomDialog = ({
    roomId = '',
    name = '',
    description = '',
    neighborhood = '',
    exits = [],
    entries = []
}) => ({
    type: ACTIVATE_ROOM_DIALOG,
    roomId,
    name,
    description,
    neighborhood,
    exits,
    entries
})

export const closeRoomDialog = () => ({ type: CLOSE_ROOM_DIALOG })
