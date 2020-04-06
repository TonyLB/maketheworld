import { createStore, combineReducers, applyMiddleware, compose } from 'redux'
import thunk from 'redux-thunk'
import connection from '../reducers/connection.js'
import messages from '../reducers/messages.js'
import webSocket from '../reducers/webSocket.js'
import name from '../reducers/name.js'
import neighborhoods from '../reducers/neighborhoods.js'
import myCharacters from '../reducers/myCharacters.js'
import charactersInPlay from '../reducers/charactersInPlay.js'
import subscriptions from '../reducers/subscriptions'
import colorMap from '../reducers/colorMap.js'
import uiReducer from '../reducers/UI'

export const store = createStore(
    combineReducers({
        connection,
        charactersInPlay,
        myCharacters,
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