import { useEffect } from 'react';

import { useDispatch } from 'react-redux'

import { registerLifeLineSSM } from '../actions/communicationsLayer/lifeLine'
import { registerPlayerSSM } from '../actions/communicationsLayer/appSyncSubscriptions'

export const useCommunicationsLayer = () => {
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(registerLifeLineSSM)
        dispatch(registerPlayerSSM)
    }, [dispatch])

}

export default useCommunicationsLayer