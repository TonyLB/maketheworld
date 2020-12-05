//
// The AppController component handles the overall state of the data model, making sure that the client is
// subscribed to appropriate data changes, and keeping tabs on asynchronous processes.
//
// It then passes arguments as needed to the appropriate View components, and arranges them in the
// Layout component.
//

import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { getMyCharacters, getMyCurrentCharacter } from '../../selectors/myCharacters'

import AppLayout from '../AppLayout'
import Profile from '../Profile'
import useAppSyncSubscriptions from '../useAppSyncSubscriptions'

export const AppController = () => {
    useAppSyncSubscriptions()
    const myCharacters = useSelector(getMyCharacters)
    return <AppLayout
        profilePanel={<Profile myCharacters={myCharacters} />}
    />
}

export default AppController
