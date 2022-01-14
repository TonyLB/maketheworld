import { useEffect } from 'react';

import { useDispatch } from 'react-redux'

import { registerLifeLineSSM } from '../actions/communicationsLayer/lifeLine'

export const useCommunicationsLayer = () => {
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(registerLifeLineSSM)
    }, [dispatch])

}

export default useCommunicationsLayer