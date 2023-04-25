import { useCallback, useMemo, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { socketDispatch } from '../../slices/lifeLine'
import { getMySettings, getStatus } from '../../slices/player'
import { OnboardingKey, onboardingCheckpointSequence } from './checkpoints'
import { addOnboardingComplete } from '../../slices/player/index.api'

export const useNextOnboarding = () => {
    const playerState = useSelector(getStatus)
    const { onboardCompleteTags } = useSelector(getMySettings)
    const nextOnboard = useMemo(() => (playerState === 'CONNECTED' ? onboardingCheckpointSequence.find((check) => (!onboardCompleteTags.includes(check))) : undefined), [onboardingCheckpointSequence, onboardCompleteTags, playerState])
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
