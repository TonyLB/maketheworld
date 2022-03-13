import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'

import uiReducer from '../slices/UI'
import settings from '../slices/settings'
import messages from '../slices/messages'
import activeCharacters from '../slices/activeCharacters'
import ephemera from '../slices/ephemera'
import player from '../slices/player'
import lifeLine from '../slices/lifeLine'
import ssmHeartbeat from '../slices/stateSeekingMachine/ssmHeartbeat'
import library from '../slices/library'

export const store = configureStore({
    reducer: {
        activeCharacters,
        lifeLine,
        ephemera,
        messages,
        player,
        library,
        settings,
        UI: uiReducer,
        ssmHeartbeat
    },
    middleware: [thunk]
})

export type AppGetState = typeof store.getState
export type RootState = ReturnType<AppGetState>
export type AppDispatch = typeof store.dispatch
export type Selector<S> = (state: RootState) => S
