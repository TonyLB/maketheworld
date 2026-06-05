import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'

import configuration from '../slices/configuration'
import uiReducer from '../slices/UI'
import settings from '../slices/settings'
import messages from '../slices/messages'
import activeCharacters from '../slices/activeCharacters'
import ephemera from '../slices/ephemera'
import lifeLine from '../slices/lifeLine'
import ssmHeartbeat from '../slices/stateSeekingMachine/ssmHeartbeat'
import personalAssets, { registerPeriodicCleanupSubscriber } from '../slices/personalAssets'
import perceptionCache from '../slices/perceptionCache'
import { contentHeadersSlice, subscribeToContentHeaders } from '../slices/contentHeaders'
import { libraryDataSourceSlice, subscribeToLibrary } from '../slices/libraryDataSource'
import { playerDataSourceSlice } from '../slices/player/playerDataSource'
import { wmlDataSourceSlice } from '../slices/wmlDataSource'
import { thinkingJobsSlice, subscribeToThinkingJobs } from '../slices/thinkingJobs'
import thinkingResults from '../slices/thinkingResults'

export const store = configureStore({
    reducer: {
        configuration,
        activeCharacters,
        lifeLine,
        ephemera,
        messages,
        personalAssets,
        settings,
        UI: uiReducer,
        ssmHeartbeat,
        perceptionCache,
        contentHeaders: contentHeadersSlice.reducer,
        libraryDataSource: libraryDataSourceSlice.reducer,
        playerDataSource: playerDataSourceSlice.reducer,
        wmlDataSource: wmlDataSourceSlice.reducer,
        thinkingJobs: thinkingJobsSlice.reducer,
        thinkingResults
    },
    middleware: [thunk]
})

// Initialize subscriptions
// Queue subscription to 'global' stream for contentHeaders
// This can be called immediately - the state machine will process it when ready
store.dispatch(subscribeToContentHeaders(['global']) as any)
store.dispatch(subscribeToThinkingJobs() as any)
registerPeriodicCleanupSubscriber(store.dispatch)

// Note: Library subscription is handled on-demand when user navigates to Library page
// See components/Library/index.tsx for subscription logic

export type AppGetState = typeof store.getState
export type RootState = ReturnType<AppGetState>
export type AppDispatch = typeof store.dispatch
export type Selector<S> = (state: RootState) => S
