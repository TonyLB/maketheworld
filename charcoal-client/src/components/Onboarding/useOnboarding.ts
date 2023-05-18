import { useCallback, useMemo, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getActiveOnboardingChapter, getMySettings, getStatus } from '../../slices/player'
import { OnboardingKey, onboardingChapters } from './checkpoints'
import { addOnboardingComplete } from '../../slices/player/index.api'

//
// TODO: Lift the selector logic here into selectors in the player slice
//
// TODO: Lift requireSequence and condition into the addOnboardingComplete thunk
//
export const useOnboardingChapterActive = () => {
    const playerState = useSelector(getStatus)
    const chapterActive = useSelector(getActiveOnboardingChapter)
    return playerState === 'CONNECTED' ? chapterActive : { index: undefined, currentChapter: undefined }
}

export const useOnboardingPage = () => {
    const playerState = useSelector(getStatus)
    const { onboardCompleteTags } = useSelector(getMySettings)
    const { index } = useOnboardingChapterActive()
    const currentPage = useMemo(() => ((playerState === 'CONNECTED' && typeof index !== 'undefined') ? onboardingChapters[index].pages.find((check) => (!onboardCompleteTags.includes(check.pageKey))) : undefined), [onboardingChapters, onboardCompleteTags, playerState])
    return currentPage
}

export const useNextOnboarding = () => {
    const currentPage = useOnboardingPage()
    const { onboardCompleteTags } = useSelector(getMySettings)
    const nextOnboard = useMemo(() => (currentPage ? currentPage.subItems.map(({ key }) => (key)).find((check) => (!onboardCompleteTags.includes(check))) : undefined), [currentPage, onboardCompleteTags])
    return nextOnboard
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
    }, [checkOnboard, requireSequence, next])
}

export default useOnboarding
