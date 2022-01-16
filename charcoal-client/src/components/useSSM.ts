import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat as getSliceHeartbeat } from '../slices/stateSeekingMachine/ssmHeartbeat'
import { iterateAllSSMs as characterEditSSMs } from '../slices/characterEdit/ssmVersion'
import { iterateAllSSMs as activeCharacterSSMs } from '../slices/activeCharacters'
import { iterateAllSSMs as ephemeraSSM } from '../slices/ephemera'
import { iterateAllSSMs as playerSSM } from '../slices/player'
import { iterateAllSSMs as lifeLineSSM } from '../slices/lifeLine'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat = useSelector(getSliceHeartbeat)
    useEffect(() => {
        dispatch(characterEditSSMs)
        dispatch(activeCharacterSSMs)
        dispatch(ephemeraSSM)
        dispatch(playerSSM)
        dispatch(lifeLineSSM)
    }, [dispatch, heartbeat])
}

export default useStateSeekingMachines
