import { useEffect } from 'react';

import { useDispatch } from 'react-redux'

import { registerLifeLineSSM } from '../actions/communicationsLayer/lifeLine'

export const useCommunicationsLayer = () => {
    const dispatch = useDispatch()

    //
    // TODO:  Revamp web-socket procedures to create and maintain one
    // web-socket for the session (and adapt protocols to handle
    // events for multiple characters)
    //
    useEffect(() => {
        dispatch(registerLifeLineSSM)
    }, [])

    //
    // TODO:  Fold useAppSyncSubscriptions into the communications layer
    //

}

export default useCommunicationsLayer