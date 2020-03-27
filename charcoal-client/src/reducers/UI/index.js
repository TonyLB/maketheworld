import { combineReducers } from 'redux'
import roomDialog from "./roomDialog"
import neighborhoodDialog from './neighorhoodDialog'

export const reducer = combineReducers({
    roomDialog,
    neighborhoodDialog
})

export default reducer