import { combineReducers } from 'redux'
import characterEdit from './characterEdit'
import feedback from './feedback'
import choiceDialog from './choiceDialog'
import navigationTabs from './navigationTabs'
import lineEntry from './lineEntry'
import mapEdit from './mapEdit'

export const reducer = combineReducers({
    feedback,
    characterEdit,
    choiceDialog,
    navigationTabs,
    lineEntry,
    mapEdit
})

export default reducer