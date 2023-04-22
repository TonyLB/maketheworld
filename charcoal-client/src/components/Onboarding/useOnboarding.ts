import { useCallback, useMemo, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { socketDispatch } from '../../slices/lifeLine'
import { getMySettings } from '../../slices/player'
import { OnboardingKey, onboardingCheckpointSequence } from './checkpoints'

export const useNextOnboarding = () => {
    const { onboardCompleteTags } = useSelector(getMySettings)
    const nextOnboard = useMemo(() => (onboardingCheckpointSequence.find((check) => (!onboardCompleteTags.includes(check)))), [onboardingCheckpointSequence, onboardCompleteTags])
    return nextOnboard
}

export const useOnboarding = (key: OnboardingKey): [boolean, () => void] => {
    const [alreadyDispatched, setAlreadyDispatched] = useState(false)
    const dispatch = useDispatch()
    const { onboardCompleteTags } = useSelector(getMySettings)
    const checked = useMemo(() => (onboardCompleteTags.includes(key)), [onboardCompleteTags, key])
    const addOnboarding = useCallback(() => {
        if (!(alreadyDispatched || checked)) {
            dispatch(socketDispatch({
                    message: 'updatePlayerSettings',
                    action: 'addOnboarding',
                    values: [key]
                }, { service: 'asset' }))
            setAlreadyDispatched(true)
        }
    }, [key, dispatch])
    return [checked, addOnboarding]
}

type UseOnboardingCheckpointOptions = {
    requireSequence?: boolean;
}

export const useOnboardingCheckpoint = (key: OnboardingKey, options: UseOnboardingCheckpointOptions = {}) => {
    const { requireSequence = false } = options
    const next = useNextOnboarding()
    const [_, checkOnboard] = useOnboarding(key)
    useEffect(() => {
        if (next === key || !requireSequence) {
            checkOnboard()
        }
    }, [checkOnboard, requireSequence, next])
}

export default useOnboarding
