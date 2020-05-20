import { createStore, combineReducers, applyMiddleware, compose } from 'redux'
import thunk from 'redux-thunk'
import connection from '../reducers/connection.js'
import messages from '../reducers/messages.js'
import webSocket from '../reducers/webSocket.js'
import registeredCharacter from '../reducers/registeredCharacter.js'
import permanentHeaders from '../reducers/permanentHeaders.js'
import maps from '../reducers/maps.js'
import player from '../reducers/player'
import role from '../reducers/role'
import myCharacters from '../reducers/myCharacters.js'
import charactersInPlay from '../reducers/charactersInPlay.js'
import subscriptions from '../reducers/subscriptions'
import uiReducer from '../reducers/UI'

export const store = createStore(
    combineReducers({
        connection,
        charactersInPlay,
        myCharacters,
        messages,
        registeredCharacter,
        role,
        permanentHeaders,
        maps,
        player,
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