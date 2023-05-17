//
// The AppController component handles the overall state of the data model, making sure that the client is
// subscribed to appropriate data changes, and keeping tabs on asynchronous processes.
//
// It then passes arguments as needed to the appropriate View components, and arranges them in the
// Layout component.
//

import React, { useEffect, useCallback, FunctionComponent } from 'react'
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
import Settings from '../Settings'
import OnboardingPanel from '../Onboarding'

type AppControllerProps = {
    signOut: () => void;
}

export const AppController: FunctionComponent<AppControllerProps> = ({ signOut }) => {
    useStateSeekingMachines()
    const myCharacters = useSelector(getMyCharacters)
    const { TextEntryLines } = useSelector(getClientSettings)
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(loadClientSettings)
    }, [dispatch])

    //
    // ToDo:  Wrap function calls being passed in useCallback, to reduce unneeded re-renders.
    //
    const profileArgs = {
        myCharacters,
        textEntryLines: TextEntryLines,
        onTextEntryChange: (value: number) => { dispatch(putClientSettings({ TextEntryLines: value })) },
        onShowNeighborhoodChange: (value: boolean) => { dispatch(putClientSettings({ ShowNeighborhoodHeaders: value })) },
    }

    const feedbackMessage = useSelector(getFirstFeedback)
    const closeFeedback = useCallback(() => {
        dispatch(popFeedback())
    }, [dispatch])

    return <AppLayout
        homePanel={<Home {...profileArgs} />}
        settingsPanel={<Settings signOut={signOut} />}
        messagePanel={<MessagePanel />}
        feedbackMessage={feedbackMessage}
        closeFeedback={closeFeedback}
        whoPanel={<WhoDrawer />}
        onboardingPanel={<OnboardingPanel />}
    />
}

export default AppController
