import { useState, useEffect } from 'react'

export const useDebouncedCallback = (callback: () => void) => {
    const [debounceMoment, setDebounce] = useState<number>(Date.now())
    const [debounceTimeout, setDebounceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
    const debouncedUpdate = () => {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout)
        }
        setDebounceTimeout(setTimeout(() => {
            setDebounce(Date.now())
            setDebounceTimeout(null)
        }, 1000))
    }
    const [lastDebounceMoment, setLastDebounceMoment] = useState<number>(0)
    useEffect(() => {
        if (debounceMoment !== lastDebounceMoment) {
            callback()
            setLastDebounceMoment(debounceMoment)
        }
    }, [debounceMoment, lastDebounceMoment, callback])
    return debouncedUpdate
}

export default useDebouncedCallback
