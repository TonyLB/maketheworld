import { combineReducers } from 'redux'

import appSyncSubscriptions from './appSyncSubscriptions'
import webSocket from './webSocket'

export const communicationsLayer = combineReducers([
    appSyncSubscriptions,
    webSocket
])