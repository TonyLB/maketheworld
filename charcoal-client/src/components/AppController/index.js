//
// The AppController component handles the overall state of the data model, making sure that the client is
// subscribed to appropriate data changes, and keeping tabs on asynchronous processes.
//
// It then passes arguments as needed to the appropriate View components, and arranges them in the
// Layout component.
//

import React, { useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// import { connectionRegister } from '../../actions/connection.js'
import { getMyCharacters } from '../../slices/player'
import { getClientSettings } from '../../slices/settings'
import { loadClientSettings, putClientSettings } from '../../slices/settings'
import { getFirstFeedback } from '../../slices/UI/feedback'
import { pop as popFeedback } from '../../slices/UI/feedback'

import AppLayout from '../AppLayout'
import Home from '../Home'
import MessagePanel from '../Message/MessagePanel'
import WhoDrawer from '../WhoDrawer'
import useStateSeekingMachines from '../useSSM'

export const AppController = () => {
    useStateSeekingMachines()
    const myCharacters = useSelector(getMyCharacters)
    const { TextEntryLines, ShowNeighborhoodHeaders = true } = useSelector(getClientSettings)
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(loadClientSettings)
    }, [dispatch])

    //
    // ToDo:  Wrap function calls being passed in useCallback, to reduce unneeded re-renders.
    //
    const profileArgs = {
        myCharacters,
        // onCharacterSavePromiseFactory: (characterData) => { dispatch(putMyCharacter(characterData)) },
        // connectCharacter: (characterId) => { dispatch(connectionRegister({ characterId })) },
        textEntryLines: TextEntryLines,
        showNeighborhoodHeaders: ShowNeighborhoodHeaders,
        onTextEntryChange: (value) => { dispatch(putClientSettings({ TextEntryLines: value })) },
        onShowNeighborhoodChange: (value) => { dispatch(putClientSettings({ ShowNeighborhoodHeaders: value })) }
    }

    const feedbackMessage = useSelector(getFirstFeedback)
    const closeFeedback = useCallback(() => {
        dispatch(popFeedback())
    }, [dispatch])

    return <AppLayout
        homePanel={<Home {...profileArgs} />}
        messagePanel={<MessagePanel />}
        feedbackMessage={feedbackMessage}
        closeFeedback={closeFeedback}
        whoPanel={<WhoDrawer />}
    />
}

export default AppController
