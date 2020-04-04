import { createStore, combineReducers, applyMiddleware, compose } from 'redux'
import thunk from 'redux-thunk'
import messages from '../reducers/messages.js'
import webSocket from '../reducers/webSocket.js'
import name from '../reducers/name.js'
import neighborhoods from '../reducers/neighborhoods.js'
import characters from '../reducers/characters.js'
import subscriptions from '../reducers/subscriptions'
import colorMap from '../reducers/colorMap.js'
import uiReducer from '../reducers/UI'

export const store = createStore(
    combineReducers({
        characters,
        colorMap,
        messages,
        name,
        neighborhoods,
        subscriptions,
        UI: uiReducer,
        webSocket
    }),
    window.__REDUX_DEVTOOLS_EXTENSION__
        ? compose(
            applyMiddleware(thunk),
            window.__REDUX_DEVTOOLS_EXTENSION__()
        )
        : applyMiddleware(thunk)
)