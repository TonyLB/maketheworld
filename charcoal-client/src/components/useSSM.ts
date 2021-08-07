import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat, getLastEvaluation } from '../selectors/stateSeekingMachine'
import { iterateAllSSMs } from '../actions/stateSeekingMachine/index'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat: string | undefined = useSelector(getHeartbeat)
    const lastEvaluation: string | undefined = useSelector(getLastEvaluation)
    useEffect(() => {
        if (heartbeat !== lastEvaluation) {
            dispatch(iterateAllSSMs)
        }
    }, [dispatch, heartbeat, lastEvaluation])
}

export default useStateSeekingMachines
