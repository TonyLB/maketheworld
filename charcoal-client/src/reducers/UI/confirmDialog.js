import { ACTIVATE_CONFIRM_DIALOG, CLOSE_CONFIRM_DIALOG } from '../../actions/UI/confirmDialog'

export const reducer = (state = [], action = {}) => {
    const {
        type,
        title = 'Are you sure?',
        content = null,
        resolveButtonTitle = 'OK',
        resolve = () => {}
    } = action

    switch (type) {

        case CLOSE_CONFIRM_DIALOG:
            return (state.length && state.slice(1)) || []
        case ACTIVATE_CONFIRM_DIALOG:
            return [...state, {
                title,
                content,
                resolveButtonTitle,
                resolve
            }]
        default:
            return state
    }
}

export default reducer