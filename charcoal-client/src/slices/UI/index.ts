import { combineReducers } from 'redux'
import feedback from './feedback'
import choiceDialog from './choiceDialog'
import lineEntry from './lineEntry'
import collaborationStatus from './collaborationStatus'
import workbench from './workbench'
import playSpine from './playSpine'

export const reducer = combineReducers({
    feedback,
    choiceDialog,
    lineEntry,
    collaborationStatus,
    workbench,
    playSpine
})

export default reducer