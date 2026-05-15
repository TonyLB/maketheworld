import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getHeartbeat as getSliceHeartbeat } from '../slices/stateSeekingMachine/ssmHeartbeat'
import { iterateAllSSMs as activeCharacterSSMs } from '../slices/activeCharacters'
import { iterateAllSSMs as ephemeraSSM } from '../slices/ephemera'
import { iterateAllSSMs as lifeLineSSM } from '../slices/lifeLine'
import { iterateAllSSMs as personalAssetsSSM } from '../slices/personalAssets'
import { iterateAllSSMs as collaborationStatusSSM } from '../slices/UI/collaborationStatus'
import { iterateContentHeaders } from '../slices/contentHeaders'
import { iterateLibraryDataSource } from '../slices/libraryDataSource'
import { iteratePlayerDataSource } from '../slices/player/playerDataSource'
import { iterateWmlDataSource } from '../slices/wmlDataSource'
import { iterateThinkingJobs } from '../slices/thinkingJobs'

export const useStateSeekingMachines = () => {
    const dispatch = useDispatch()
    const heartbeat = useSelector(getSliceHeartbeat)
    useEffect(() => {
        dispatch(activeCharacterSSMs)
        dispatch(ephemeraSSM)
        dispatch(lifeLineSSM)
        dispatch(personalAssetsSSM)
        dispatch(collaborationStatusSSM)
        dispatch(iterateContentHeaders)
        dispatch(iterateLibraryDataSource)
        dispatch(iteratePlayerDataSource)
        dispatch(iterateWmlDataSource)
        dispatch(iterateThinkingJobs)
    }, [dispatch, heartbeat])
}

export default useStateSeekingMachines
