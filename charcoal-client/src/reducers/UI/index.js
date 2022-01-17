import { combineReducers } from 'redux'
import clientSettingsDialog from './clientSettingsDialog'
import confirmDialog from './confirmDialog'
import helpDialog from './helpDialog'
import directMessageDialog from './directMessageDialog'
import mapDialog from './mapDialog'
import editMapDialog from './editMapDialog'
import characterEdit from '../../slices/characterEdit/ssmVersion'
import feedback from '../../slices/UI/feedback'

export const reducer = combineReducers({
    clientSettingsDialog,
    feedback,
    confirmDialog,
    helpDialog,
    directMessageDialog,
    mapDialog,
    editMapDialog,
    characterEdit
})

export default reducer