import { useEffect } from 'react';

import { useDispatch } from 'react-redux'

import { registerLifeLineSSM } from '../actions/communicationsLayer/lifeLine'
import { registerPermanentsSSM, registerPlayerSSM, registerEphemeraSSM } from '../actions/communicationsLayer/appSyncSubscriptions'

export const useCommunicationsLayer = () => {
    const dispatch = useDispatch()

    //
    // TODO:  Revamp web-socket procedures to create and maintain one
    // web-socket for the session (and adapt protocols to handle
    // events for multiple characters)
    //
    useEffect(() => {
        dispatch(registerLifeLineSSM)
        dispatch(registerPermanentsSSM)
        dispatch(registerPlayerSSM)
        dispatch(registerEphemeraSSM)
    }, [dispatch])

    //
    // TODO:  Fold useAppSyncSubscriptions into the communications layer
    //

}

export default useCommunicationsLayer