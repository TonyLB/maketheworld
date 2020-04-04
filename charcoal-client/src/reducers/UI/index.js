import { combineReducers } from 'redux'
import allCharactersDialog from './allCharactersDialog'
import characterDialog from './characterDialog'
import roomDialog from "./roomDialog"
import neighborhoodDialog from './neighborhoodDialog'
import worldDialog from './worldDialog'

export const reducer = combineReducers({
    allCharactersDialog,
    characterDialog,
    roomDialog,
    worldDialog,
    neighborhoodDialog
})

export default reducer