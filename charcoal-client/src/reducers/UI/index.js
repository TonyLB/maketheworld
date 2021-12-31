import { combineReducers } from 'redux'
import clientSettingsDialog from './clientSettingsDialog'
import feedback from './feedback'
import confirmDialog from './confirmDialog'
import helpDialog from './helpDialog'
import directMessageDialog from './directMessageDialog'
import mapDialog from './mapDialog'
import editMapDialog from './editMapDialog'
import characterEdit from '../../slices/characterEdit/ssmVersion'

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