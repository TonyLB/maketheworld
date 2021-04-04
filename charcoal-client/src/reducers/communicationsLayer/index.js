import { combineReducers } from 'redux'

import appSyncSubscriptions from './appSyncSubscriptions'
import lifeLine from './lifeLine'

export const communicationsLayer = combineReducers({
    appSyncSubscriptions,
    lifeLine
})

export default communicationsLayer
