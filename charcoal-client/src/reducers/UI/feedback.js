//
// feedback is a slice in the UI portion of the redux store that
// maintains a FIFO queue of feedback messages from the internals
// of the system (e.g. failure to connect to the backend) to
// populate a Material UI Snackbar component.
//

import {
    FEEDBACK_PUSH_MESSAGE,
    FEEDBACK_POP_MESSAGE
} from '../../actions/UI/feedback'

export const reducer = (state = [], action = {}) => {
    const {
        type,
        message = ''
    } = action

    switch (type) {

        case FEEDBACK_PUSH_MESSAGE:
            if (message) {
                return [...state, message]
            }
            else {
                return state
            }

        case FEEDBACK_POP_MESSAGE:
            return state.slice(1)

        default:
            return state
    }
}

export default reducer