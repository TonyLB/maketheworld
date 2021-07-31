import { useEffect } from 'react';

import { useDispatch } from 'react-redux'

import { registerLifeLineSSM } from '../actions/communicationsLayer/lifeLine'
import { registerPermanentsSSM, registerPlayerSSM, registerEphemeraSSM } from '../actions/communicationsLayer/appSyncSubscriptions'

export const useCommunicationsLayer = () => {
    const dispatch = useDispatch()

    //
    // TODO:  Dispatch registerEphemera only as a .then on the
    // dispatch of registerLifeLineSSM, rather than in parallel
    // with establishing the LifeLine.
    //
    // Doing this will require figuring out how to depend a dispatch
    // upon the reaching of a particular state in a state machine.
    //
    // Alternately, the EphemeraSSM can be altered to include a holding
    // pattern that waits for a live webSocket.  This will require
    // some revamping of the SSM system to allow for holding patterns.
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