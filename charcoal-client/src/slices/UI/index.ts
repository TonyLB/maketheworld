import { combineReducers } from 'redux'
import feedback from './feedback'
import choiceDialog from './choiceDialog'
import lineEntry from './lineEntry'
import collaborationStatus from './collaborationStatus'
import workbench from './workbench'

export const reducer = combineReducers({
    feedback,
    choiceDialog,
    lineEntry,
    collaborationStatus,
    workbench
})

export default reducer