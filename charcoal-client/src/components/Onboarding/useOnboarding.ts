import { useCallback, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { socketDispatch } from '../../slices/lifeLine'
import { getMySettings } from '../../slices/player'

export const useOnboarding = (key: string): [boolean, () => void] => {
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

export default useOnboarding
