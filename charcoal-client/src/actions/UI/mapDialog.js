export const ACTIVATE_MAP_DIALOG = 'ACTIVATE_MAP_DIALOG'
export const ACTIVATE_EDIT_MAP_DIALOG = 'ACTIVATE_EDIT_MAP_DIALOG'
export const CLOSE_MAP_DIALOG = 'CLOSE_MAP_DIALOG'
export const CLOSE_EDIT_MAP_DIALOG = 'CLOSE_EDIT_MAP_DIALOG'

export const activateMapDialog = () => ({
    type: ACTIVATE_MAP_DIALOG
})

export const closeMapDialog = () => ({ type: CLOSE_MAP_DIALOG })

export const activateEditMapDialog = (map) => ({
    type: ACTIVATE_EDIT_MAP_DIALOG,
    map
})

export const closeEditMapDialog = () => ({ type: CLOSE_EDIT_MAP_DIALOG })
