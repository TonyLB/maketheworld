import { createStore, combineReducers, applyMiddleware, compose } from 'redux'
import thunk from 'redux-thunk'
import messages from '../reducers/messages.js'
import webSocket from '../reducers/webSocket.js'
import name from '../reducers/name.js'

export const store = createStore(
    combineReducers({
        messages,
        name,
        webSocket
    }),
    window.__REDUX_DEVTOOLS_EXTENSION__
        ? compose(
            applyMiddleware(thunk),
            window.__REDUX_DEVTOOLS_EXTENSION__()
        )
        : applyMiddleware(thunk)
)