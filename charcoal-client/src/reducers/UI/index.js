import { combineReducers } from 'redux'
import roomDialog from "./roomDialog"
import neighborhoodDialog from './neighborhoodDialog'
import worldDialog from './worldDialog'

export const reducer = combineReducers({
    roomDialog,
    worldDialog,
    neighborhoodDialog
})

export default reducer