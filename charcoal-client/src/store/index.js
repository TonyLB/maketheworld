import { createStore, combineReducers, applyMiddleware, compose } from 'redux'
import thunk from 'redux-thunk'
import backups from '../reducers/backups.js'
import characters from '../reducers/characters.js'
import grants from '../reducers/grants.js'
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
import settings from '../reducers/settings'
import clientSettings from '../reducers/clientSettings'
import uiReducer from '../reducers/UI'

export const store = createStore(
    combineReducers({
        backups,
        characters,
        connection,
        charactersInPlay,
        clientSettings,
        myCharacters,
        grants,
        messages,
        registeredCharacter,
        role,
        permanentHeaders,
        maps,
        player,
        settings,
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