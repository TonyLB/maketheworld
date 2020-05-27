import { getSettings } from '../../selectors/settings'

export const ACTIVATE_ADMIN_DIALOG = 'ACTIVATE_ADMIN_DIALOG'
export const CLOSE_ADMIN_DIALOG = 'CLOSE_ADMIN_DIALOG'

export const activateAdminDialog = (dispatch, getState) => {
    const settings = getSettings(getState())
    dispatch({ type: ACTIVATE_ADMIN_DIALOG, settings })
}

export const closeAdminDialog = () => ({ type: CLOSE_ADMIN_DIALOG })
