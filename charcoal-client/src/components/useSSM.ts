import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat as getSliceHeartbeat } from '../slices/stateSeekingMachine/ssmHeartbeat'
import { iterateAllSSMs as activeCharacterSSMs } from '../slices/activeCharacters'
import { iterateAllSSMs as ephemeraSSM } from '../slices/ephemera'
import { iterateAllSSMs as playerSSM } from '../slices/player'
import { iterateAllSSMs as lifeLineSSM } from '../slices/lifeLine'
import { iterateAllSSMs as librarySSM } from '../slices/library'
import { iterateAllSSMs as personalAssetsSSM } from '../slices/personalAssets'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat = useSelector(getSliceHeartbeat)
    useEffect(() => {
        dispatch(activeCharacterSSMs)
        dispatch(ephemeraSSM)
        dispatch(playerSSM)
        dispatch(lifeLineSSM)
        dispatch(librarySSM)
        dispatch(personalAssetsSSM)
    }, [dispatch, heartbeat])
}

export default useStateSeekingMachines
