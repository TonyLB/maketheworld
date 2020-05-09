export const ACTIVATE_ROOM_DIALOG = 'ACTIVATE_ROOM_DIALOG'
export const CLOSE_ROOM_DIALOG = 'CLOSE_ROOM_DIALOG'

export const activateRoomDialog = ({
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
}) => ({
    type: ACTIVATE_ROOM_DIALOG,
    RoomId,
    Name,
    Description,
    Ancestry,
    ParentId,
    parentName,
    parentAncestry,
    Exits,
    Entries,
    nested
})

export const closeRoomDialog = () => ({ type: CLOSE_ROOM_DIALOG })
