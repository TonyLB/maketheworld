import { combineReducers } from 'redux'
import feedback from './feedback'
import choiceDialog from './choiceDialog'
import lineEntry from './lineEntry'
import collaborationStatus from './collaborationStatus'

export const reducer = combineReducers({
    feedback,
    choiceDialog,
    lineEntry,
    collaborationStatus
})

export default reducer