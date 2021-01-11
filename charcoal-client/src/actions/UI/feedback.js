export const FEEDBACK_PUSH_MESSAGE = 'FEEDBACK_PUSH_MESSAGE'
export const FEEDBACK_POP_MESSAGE = 'FEEDBACK_POP_MESSAGE'

export const pushFeedback = (message) => ({
    type: FEEDBACK_PUSH_MESSAGE,
    message
})

export const popFeedback = {
    type: FEEDBACK_POP_MESSAGE
}
