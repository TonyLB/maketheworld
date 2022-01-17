import { combineReducers } from 'redux'
import confirmDialog from './confirmDialog'
import helpDialog from './helpDialog'
import directMessageDialog from './directMessageDialog'
import characterEdit from '../../slices/characterEdit/ssmVersion'
import feedback from '../../slices/UI/feedback'

export const reducer = combineReducers({
    feedback,
    confirmDialog,
    helpDialog,
    directMessageDialog,
    characterEdit
})

export default reducer