import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'

import configuration from '../slices/configuration'
import uiReducer from '../slices/UI'
import settings from '../slices/settings'
import messages from '../slices/messages'
import notifications from '../slices/notifications'
import activeCharacters from '../slices/activeCharacters'
import ephemera from '../slices/ephemera'
import player from '../slices/player'
import lifeLine from '../slices/lifeLine'
import ssmHeartbeat from '../slices/stateSeekingMachine/ssmHeartbeat'
import library from '../slices/library'
import personalAssets from '../slices/personalAssets'
import perceptionCache from '../slices/perceptionCache'

export const store = configureStore({
    reducer: {
        configuration,
        activeCharacters,
        lifeLine,
        ephemera,
        messages,
        notifications,
        player,
        library,
        personalAssets,
        settings,
        UI: uiReducer,
        ssmHeartbeat,
        perceptionCache
    },
    middleware: [thunk]
})

export type AppGetState = typeof store.getState
export type RootState = ReturnType<AppGetState>
export type AppDispatch = typeof store.dispatch
export type Selector<S> = (state: RootState) => S
