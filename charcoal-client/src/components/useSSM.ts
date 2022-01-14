import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat, getLastEvaluation } from '../selectors/stateSeekingMachine'
import { getHeartbeat as getSliceHeartbeat } from '../slices/stateSeekingMachine/ssmHeartbeat'
import { iterateAllSSMs } from '../actions/stateSeekingMachine/index'
import { iterateAllSSMs as characterEditSSMs } from '../slices/characterEdit/ssmVersion'
import { iterateAllSSMs as activeCharacterSSMs } from '../slices/activeCharacters'
import { iterateAllSSMs as ephemeraSSM } from '../slices/ephemera'
import { iterateAllSSMs as playerSSM } from '../slices/player'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat: string | undefined = useSelector(getHeartbeat)
    const sliceHeartbeat = useSelector(getSliceHeartbeat)
    useEffect(() => {
        dispatch(iterateAllSSMs)
        dispatch(characterEditSSMs)
        dispatch(activeCharacterSSMs)
        dispatch(ephemeraSSM)
        dispatch(playerSSM)
    }, [dispatch, heartbeat, sliceHeartbeat])
}

export default useStateSeekingMachines
