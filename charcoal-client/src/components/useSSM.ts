import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat as getSliceHeartbeat } from '../slices/stateSeekingMachine/ssmHeartbeat'
import { iterateAllSSMs as activeCharacterSSMs } from '../slices/activeCharacters'
import { iterateAllSSMs as ephemeraSSM } from '../slices/ephemera'
import { iterateAllSSMs as playerSSM } from '../slices/player'
import { iterateAllSSMs as lifeLineSSM } from '../slices/lifeLine'
import { iterateAllSSMs as personalAssetsSSM } from '../slices/personalAssets'
import { iterateAllSSMs as collaborationStatusSSM } from '../slices/UI/collaborationStatus'
import { iterateContentHeaders } from '../slices/contentHeaders'
import { iterateLibraryDataSource } from '../slices/libraryDataSource'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat = useSelector(getSliceHeartbeat)
    useEffect(() => {
        dispatch(activeCharacterSSMs)
        dispatch(ephemeraSSM)
        dispatch(playerSSM)
        dispatch(lifeLineSSM)
        dispatch(personalAssetsSSM)
        dispatch(collaborationStatusSSM)
        dispatch(iterateContentHeaders)
        dispatch(iterateLibraryDataSource)
    }, [dispatch, heartbeat])
}

export default useStateSeekingMachines
