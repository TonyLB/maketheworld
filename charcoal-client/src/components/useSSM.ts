import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat, getLastEvaluation } from '../selectors/stateSeekingMachine'
import { getHeartbeat as getSliceHeartbeat } from '../slices/stateSeekingMachine/ssmHeartbeat'
import { iterateAllSSMs } from '../actions/stateSeekingMachine/index'
import { iterateAllSSMs as characterEditSSMs } from '../slices/characterEdit/ssmVersion'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat: string | undefined = useSelector(getHeartbeat)
    const sliceHeartbeat = useSelector(getSliceHeartbeat)
    useEffect(() => {
        dispatch(iterateAllSSMs)
        dispatch(characterEditSSMs)
    }, [dispatch, heartbeat, sliceHeartbeat])
}

export default useStateSeekingMachines
