import { useState, useEffect } from 'react'

export const useDebouncedCallback = (callback: (...props: any[]) => void) => {
    const [debounceMoment, setDebounce] = useState<number>(Date.now())
    const [debounceTimeout, setDebounceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
    const [props, setProps] = useState<any[]>([])
    const debouncedUpdate = (...props: any[]) => {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout)
        }
        setProps(props)
        setDebounceTimeout(setTimeout(() => {
            setDebounce(Date.now())
            setDebounceTimeout(null)
        }, 1000))
    }
    const [lastDebounceMoment, setLastDebounceMoment] = useState<number>(0)
    useEffect(() => {
        if (debounceMoment !== lastDebounceMoment) {
            callback(...props)
            setProps([])
            setLastDebounceMoment(debounceMoment)
        }
    }, [debounceMoment, lastDebounceMoment, callback, props])
    return debouncedUpdate
}

export default useDebouncedCallback
