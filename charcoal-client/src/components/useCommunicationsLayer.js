import { useEffect } from 'react';

import { useSelector, useDispatch } from 'react-redux'

import { establishWebSocket } from '../actions/webSocket'
import { getCharacterId } from '../selectors/connection'

export const useCommunicationsLayer = () => {
    const dispatch = useDispatch()

    //
    // TODO:  Revamp web-socket procedures to create and maintain one
    // web-socket for the session (and adapt protocols to handle
    // events for multiple characters)
    //
    useEffect(() => {
        if (CharacterId) {
            dispatch(establishWebSocket(CharacterId))
        }
    }, [CharacterId, dispatch])

    //
    // TODO:  Fold useAppSyncSubscriptions into the communications layer
    //

}

export default useCommunicationsLayer