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
import { getMyCharacters } from '../../selectors/player'
import { getClientSettings } from '../../selectors/clientSettings'
import { loadClientSettings, putClientSettings } from '../../actions/clientSettings'
import { getFirstFeedback } from '../../selectors/UI/feedback'
import { popFeedback } from '../../actions/UI/feedback'

import AppLayout from '../AppLayout'
import Home from '../Home'
import MessagePanel from '../Message/MessagePanel'
import WhoDrawer from '../WhoDrawer'
import useStateSeekingMachines from '../useSSM'
import useCommunicationsLayer from '../useCommunicationsLayer'

export const AppController = () => {
    useStateSeekingMachines()
    useCommunicationsLayer()
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
        dispatch(popFeedback)
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
