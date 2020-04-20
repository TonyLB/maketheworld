import { combineReducers } from 'redux'
import allCharactersDialog from './allCharactersDialog'
import myCharacterDialog from './myCharacterDialog'
import roomDialog from "./roomDialog"
import neighborhoodDialog from './neighborhoodDialog'
import worldDialog from './worldDialog'
import confirmDialog from './confirmDialog'
import helpDialog from './helpDialog'

export const reducer = combineReducers({
    allCharactersDialog,
    myCharacterDialog,
    roomDialog,
    worldDialog,
    neighborhoodDialog,
    confirmDialog,
    helpDialog
})

export default reducer