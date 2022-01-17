import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'
import uiReducer from '../reducers/UI'

import settings from '../slices/settings'
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

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type Selector<S> = (state: RootState) => S
