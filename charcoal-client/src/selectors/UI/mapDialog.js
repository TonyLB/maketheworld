export const getMapDialogUI = (state) => (state && state.UI && state.UI.mapDialog) || false

export const getEditMapDialogUI = (state) => (state && state.UI && state.UI.editMapDialog) || { open: false, map: null }
