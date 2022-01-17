import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'
import settings from '../reducers/settings'
import clientSettings from '../reducers/clientSettings'
import uiReducer from '../reducers/UI'

import messages from '../slices/messages'
import navigationTabs from '../slices/navigationTabs'
import activeCharacters from '../slices/activeCharacters'
import ephemera from '../slices/ephemera'
import player from '../slices/player'
import lifeLine from '../slices/lifeLine'
import ssmHeartbeat from '../slices/stateSeekingMachine/ssmHeartbeat'

export const store = configureStore({
    reducer: {
        activeCharacters,
        lifeLine,
        clientSettings,
        ephemera,
        messages,
        player,
        settings,
        UI: uiReducer,
        navigationTabs,
        ssmHeartbeat
    },
    middleware: [thunk]
})
