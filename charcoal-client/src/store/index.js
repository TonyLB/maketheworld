import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'
import backups from '../reducers/backups.js'
import characters from '../reducers/characters.js'
import grants from '../reducers/grants.js'
import connection from '../reducers/connection.js'
import messages from '../reducers/messages.js'
import webSocket from '../reducers/webSocket.js'
import permanentHeaders from '../reducers/permanentHeaders.js'
import exits from '../reducers/exits.js'
import maps from '../reducers/maps.js'
import player from '../reducers/player'
import role from '../reducers/role'
import charactersInPlay from '../reducers/charactersInPlay.js'
import communicationsLayer from '../reducers/communicationsLayer'
import stateSeekingMachines from '../reducers/stateSeekingMachine/'
import subscriptions from '../reducers/subscriptions'
import settings from '../reducers/settings'
import clientSettings from '../reducers/clientSettings'
import uiReducer from '../reducers/UI'

import navigationTabs from '../slices/navigationTabs'

export const store = configureStore({
    reducer: {
        backups,
        characters,
        communicationsLayer,
        connection,
        charactersInPlay,
        clientSettings,
        grants,
        messages,
        role,
        permanentHeaders,
        exits,
        maps,
        player,
        settings,
        stateSeekingMachines,
        subscriptions,
        UI: uiReducer,
        webSocket,
        navigationTabs
    },
    middleware: [thunk]
})
