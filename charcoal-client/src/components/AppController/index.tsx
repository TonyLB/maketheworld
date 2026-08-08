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
import { loadClientSettings, putClientSettings } from '../../slices/settings'
import { getFirstFeedback } from '../../slices/UI/feedback'
import { pop as popFeedback } from '../../slices/UI/feedback'
import { loadWorkbenchSettings } from '../../slices/UI/workbench'

import AppLayout from '../AppLayout'
import MessagePanel from '../Message/MessagePanel'
import WhoDrawer from '../WhoDrawer'
import Settings from '../Settings'
import Onboarding from '../Onboarding'
import { SignInOrUp } from '../SignIn'

type AppControllerProps = {}

export const AppController: FunctionComponent<AppControllerProps> = ({}) => {
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(loadClientSettings)
        dispatch(loadWorkbenchSettings)
    }, [dispatch])

    const onAlwaysShowOnboardingChange = (value: boolean) => { dispatch(putClientSettings({ AlwaysShowOnboarding: value })) }

    const feedbackMessage = useSelector(getFirstFeedback)
    const closeFeedback = useCallback(() => {
        dispatch(popFeedback())
    }, [dispatch])

    return <AppLayout
        settingsPanel={<Settings onAlwaysShowOnboardingChange={onAlwaysShowOnboardingChange} />}
        messagePanel={<MessagePanel />}
        feedbackMessage={feedbackMessage}
        closeFeedback={closeFeedback}
        whoPanel={<WhoDrawer />}
        onboardingPanel={<Onboarding />}
        signInOrUp={<SignInOrUp />}
    />
}

export default AppController
