import { combineReducers } from 'redux'
import activeCharacters from './activeCharacters'
import adminDialog from './adminDialog'
import allCharactersDialog from './allCharactersDialog'
import clientSettingsDialog from './clientSettingsDialog'
import myCharacterDialog from './myCharacterDialog'
import roomDialog from "./roomDialog"
import neighborhoodDialog from './neighborhoodDialog'
import worldDialog from './worldDialog'
import confirmDialog from './confirmDialog'
import helpDialog from './helpDialog'
import directMessageDialog from './directMessageDialog'
import mapDialog from './mapDialog'
import editMapDialog from './editMapDialog'

export const reducer = combineReducers({
    activeCharacters,
    adminDialog,
    allCharactersDialog,
    clientSettingsDialog,
    myCharacterDialog,
    roomDialog,
    worldDialog,
    neighborhoodDialog,
    confirmDialog,
    helpDialog,
    directMessageDialog,
    mapDialog,
    editMapDialog
})

export default reducer