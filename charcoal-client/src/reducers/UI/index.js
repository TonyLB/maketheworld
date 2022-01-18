import { combineReducers } from 'redux'
import characterEdit from '../../slices/characterEdit/ssmVersion'
import feedback from '../../slices/UI/feedback'
import choiceDialog from '../../slices/UI/choiceDialog'

export const reducer = combineReducers({
    feedback,
    characterEdit,
    choiceDialog
})

export default reducer