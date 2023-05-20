import { useCallback, useMemo, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getActiveOnboardingChapter, getMySettings, getOnboardingPage, getStatus, getNextOnboarding } from '../../slices/player'
import { OnboardingKey } from './checkpoints'
import { addOnboardingComplete } from '../../slices/player/index.api'

export const useOnboardingChapterActive = () => {
    const playerState = useSelector(getStatus)
    const chapterActive = useSelector(getActiveOnboardingChapter)
    return playerState === 'CONNECTED' ? chapterActive : { index: undefined, currentChapter: undefined }
}

export const useOnboardingPage = () => {
    const playerState = useSelector(getStatus)
    const page = useSelector(getOnboardingPage)
    const currentPage = useMemo(() => (playerState === 'CONNECTED' ? page : undefined), [page, playerState])
    return currentPage
}

export const useNextOnboarding = () => {
    return useSelector(getNextOnboarding)
}

export const useOnboarding = (key: OnboardingKey): [boolean, () => void] => {
    const [alreadyDispatched, setAlreadyDispatched] = useState(false)
    const dispatch = useDispatch()
    const { onboardCompleteTags } = useSelector(getMySettings)
    const checked = useMemo(() => (onboardCompleteTags.includes(key)), [onboardCompleteTags, key])
    const addOnboarding = useCallback(() => {
        if (!(alreadyDispatched || checked)) {
            dispatch(addOnboardingComplete([key]))
            setAlreadyDispatched(true)
        }
    }, [key, dispatch])
    return [checked, addOnboarding]
}

type UseOnboardingCheckpointOptions = {
    requireSequence?: boolean;
    condition?: boolean;
}

export const useOnboardingCheckpoint = (key: OnboardingKey, options: UseOnboardingCheckpointOptions = {}) => {
    const { requireSequence = false, condition = true } = options
    const next = useNextOnboarding()
    const [_, checkOnboard] = useOnboarding(key)
    useEffect(() => {
        if (condition && (next === key || !requireSequence)) {
            checkOnboard()
        }
    }, [checkOnboard, requireSequence, next, condition, key])
}

export default useOnboarding
