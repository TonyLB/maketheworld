import { combineReducers } from 'redux'
import feedback from './feedback'
import choiceDialog from './choiceDialog'
import navigationTabs from './navigationTabs'
import lineEntry from './lineEntry'

export const reducer = combineReducers({
    feedback,
    choiceDialog,
    navigationTabs,
    lineEntry
})

export default reducer