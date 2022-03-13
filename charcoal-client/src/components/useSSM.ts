import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat as getSliceHeartbeat } from '../slices/stateSeekingMachine/ssmHeartbeat'
import { iterateAllSSMs as characterEditSSMs } from '../slices/UI/characterEdit'
import { iterateAllSSMs as activeCharacterSSMs } from '../slices/activeCharacters'
import { iterateAllSSMs as ephemeraSSM } from '../slices/ephemera'
import { iterateAllSSMs as playerSSM } from '../slices/player'
import { iterateAllSSMs as lifeLineSSM } from '../slices/lifeLine'
import { iterateAllSSMs as librarySSM } from '../slices/library'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat = useSelector(getSliceHeartbeat)
    useEffect(() => {
        dispatch(characterEditSSMs)
        dispatch(activeCharacterSSMs)
        dispatch(ephemeraSSM)
        dispatch(playerSSM)
        dispatch(lifeLineSSM)
        dispatch(librarySSM)
    }, [dispatch, heartbeat])
}

export default useStateSeekingMachines
