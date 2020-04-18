export const ACTIVATE_CONFIRM_DIALOG = 'ACTIVATE_CONFIRM_DIALOG'
export const CLOSE_CONFIRM_DIALOG = 'CLOSE_CONFIRM_DIALOG'

export const activateConfirmDialog = ({
    title = 'Are you sure?',
    content = null,
    resolveButtonTitle = 'OK',
    resolve = () => {}
} = {}) => ({
    type: ACTIVATE_CONFIRM_DIALOG,
    title,
    content,
    resolveButtonTitle,
    resolve
})

export const closeConfirmDialog = () => ({ type: CLOSE_CONFIRM_DIALOG })
