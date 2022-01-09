import { useEffect } from 'react';

import { useDispatch } from 'react-redux'

import { registerLifeLineSSM } from '../actions/communicationsLayer/lifeLine'
import { registerPlayerSSM, registerEphemeraSSM } from '../actions/communicationsLayer/appSyncSubscriptions'

export const useCommunicationsLayer = () => {
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(registerLifeLineSSM)
        dispatch(registerPlayerSSM)
        dispatch(registerEphemeraSSM)
    }, [dispatch])

    //
    // TODO:  Fold useAppSyncSubscriptions into the communications layer
    //

}

export default useCommunicationsLayer