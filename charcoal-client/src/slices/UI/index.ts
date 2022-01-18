import { combineReducers } from 'redux'
import characterEdit from './characterEdit'
import feedback from './feedback'
import choiceDialog from './choiceDialog'
import navigationTabs from './navigationTabs'

export const reducer = combineReducers({
    feedback,
    characterEdit,
    choiceDialog,
    navigationTabs
})

export default reducer