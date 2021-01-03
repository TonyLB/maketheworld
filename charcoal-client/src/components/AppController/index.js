//
// The AppController component handles the overall state of the data model, making sure that the client is
// subscribed to appropriate data changes, and keeping tabs on asynchronous processes.
//
// It then passes arguments as needed to the appropriate View components, and arranges them in the
// Layout component.
//

import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { connectionRegister } from '../../actions/connection.js'
import { getMyCharacters } from '../../selectors/myCharacters'
import { putMyCharacter } from '../../actions/characters'
import { getClientSettings } from '../../selectors/clientSettings'
import { loadClientSettings, putClientSettings } from '../../actions/clientSettings'
import { getCharacterId } from '../../selectors/connection'
import useConnectedCharacter from '../useConnectedCharacter'

import AppLayout from '../AppLayout'
import Profile from '../Profile'
import MessagePanel from '../Message/MessagePanel'
import useAppSyncSubscriptions from '../useAppSyncSubscriptions'

export const AppController = () => {
    useAppSyncSubscriptions()
    const myCharacters = useSelector(getMyCharacters)
    const { TextEntryLines, ShowNeighborhoodHeaders = true } = useSelector(getClientSettings)
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(loadClientSettings)
    }, [dispatch])

    const profileArgs = {
        myCharacters,
        onCharacterSavePromiseFactory: (characterData) => { dispatch(putMyCharacter(characterData)) },
        connectCharacter: (characterId) => { dispatch(connectionRegister({ characterId })) },
        textEntryLines: TextEntryLines,
        showNeighborhoodHeaders: ShowNeighborhoodHeaders,
        onTextEntryChange: (value) => { dispatch(putClientSettings({ TextEntryLines: value })) },
        onShowNeighborhoodChange: (value) => { dispatch(putClientSettings({ ShowNeighborhoodHeaders: value })) }
    }

    useConnectedCharacter()
    const viewAsCharacterId = useSelector(getCharacterId)

    const messageArgs = {
        viewAsCharacterId
    }

    return <AppLayout
        profilePanel={<Profile {...profileArgs} />}
        messagePanel={<MessagePanel {...messageArgs} />}
    />
}

export default AppController
