import { combineReducers } from 'redux'
import characterEdit from '../characterEdit/ssmVersion'
import feedback from './feedback'
import choiceDialog from './choiceDialog'

export const reducer = combineReducers({
    feedback,
    characterEdit,
    choiceDialog
})

export default reducer