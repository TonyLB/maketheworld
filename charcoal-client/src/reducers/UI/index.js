import { combineReducers } from 'redux'
import adminDialog from './adminDialog'
import clientSettingsDialog from './clientSettingsDialog'
import feedback from './feedback'
import myCharacterDialog from './myCharacterDialog'
import confirmDialog from './confirmDialog'
import helpDialog from './helpDialog'
import directMessageDialog from './directMessageDialog'
import mapDialog from './mapDialog'
import editMapDialog from './editMapDialog'

export const reducer = combineReducers({
    adminDialog,
    clientSettingsDialog,
    feedback,
    myCharacterDialog,
    confirmDialog,
    helpDialog,
    directMessageDialog,
    mapDialog,
    editMapDialog
})

export default reducer