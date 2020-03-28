import { combineReducers } from 'redux'
import roomDialog from "./roomDialog"
import worldDialog from './worldDialog'

export const reducer = combineReducers({
    roomDialog,
    worldDialog
})

export default reducer