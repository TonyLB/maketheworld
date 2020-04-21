export const ACTIVATE_DIRECT_MESSAGE_DIALOG = 'ACTIVATE_DIRECT_MESSAGE_DIALOG'
export const CLOSE_DIRECT_MESSAGE_DIALOG = 'CLOSE_DIRECT_MESSAGE_DIALOG'

export const activateDirectMessageDialog = (ToCharacterId = '') => ({
    type: ACTIVATE_DIRECT_MESSAGE_DIALOG,
    ToCharacterId
})

export const closeDirectMessageDialog = () => ({ type: CLOSE_DIRECT_MESSAGE_DIALOG })
