import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'
import messages from '../reducers/messages.js'
import player from '../reducers/player'
import charactersInPlay from '../reducers/charactersInPlay.js'
import communicationsLayer from '../reducers/communicationsLayer'
import stateSeekingMachines from '../reducers/stateSeekingMachine/'
import settings from '../reducers/settings'
import clientSettings from '../reducers/clientSettings'
import uiReducer from '../reducers/UI'

import navigationTabs from '../slices/navigationTabs'

export const store = configureStore({
    reducer: {
        communicationsLayer,
        charactersInPlay,
        clientSettings,
        messages,
        player,
        settings,
        stateSeekingMachines,
        UI: uiReducer,
        navigationTabs
    },
    middleware: [thunk]
})
