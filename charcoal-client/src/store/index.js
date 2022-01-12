import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'
import messages from '../reducers/messages.js'
import player from '../reducers/player'
import communicationsLayer from '../reducers/communicationsLayer'
import stateSeekingMachines from '../reducers/stateSeekingMachine/'
import settings from '../reducers/settings'
import clientSettings from '../reducers/clientSettings'
import uiReducer from '../reducers/UI'

import navigationTabs from '../slices/navigationTabs'
// import characterEdit from '../slices/characterEdit'
import activeCharacters from '../slices/activeCharacters/'
import ephemera from '../slices/ephemera'
import ssmHeartbeat from '../slices/stateSeekingMachine/ssmHeartbeat'

export const store = configureStore({
    reducer: {
        activeCharacters,
        communicationsLayer,
        clientSettings,
        ephemera,
        messages,
        player,
        settings,
        stateSeekingMachines,
        UI: uiReducer,
        navigationTabs,
        // characterEdit,
        ssmHeartbeat
    },
    middleware: [thunk]
})
