import { useState, useEffect } from 'react'
import { deepEqual } from '../lib/objects';

//
// useDebounce lifted from https://usehooks.com/useDebounce/
//
export const useDebounce = <T>(value: T, delay: number) => {
    // State and setters for debounced value
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(
        () => {
            // Update debounced value after delay
            const handler = setTimeout(() => {
                setDebouncedValue(value)
            }, delay)
            // Cancel the timeout if value changes (also on delay change or unmount)
            // This is how we prevent debounced value from updating if value is changed ...
            // .. within the delay period. Timeout gets cleared and restarted.
            return () => {
                clearTimeout(handler)
            }
        },
        [value, delay] // Only re-call effect if value or delay changes
    )
    return debouncedValue
}

export const useDebouncedOnChange = <T>({ value, delay, onChange }: { value: T; delay: number; onChange: (value: T) => void }) => {
    const [baseValue, setBaseValue] = useState<T>(value)
    const debouncedValue = useDebounce(value, delay)
    useEffect(
        () => {
            if (!deepEqual(baseValue, debouncedValue)) {
                onChange(debouncedValue)
                setBaseValue(debouncedValue)
            }
        },
        [baseValue, debouncedValue, onChange, setBaseValue]
    )
}

export const useDebouncedState = <T>({ value, delay, onChange }: { value: T; delay: number; onChange: (value: T) => void }): [T, (value: T) => void] => {
    const [baseValue, setBaseValue] = useState<T>(value)
    const [currentValue, setCurrentValue] = useState<T>(value)
    const debouncedValue = useDebounce(currentValue, delay)
    useEffect(
        () => {
            if (!deepEqual(baseValue, debouncedValue)) {
                setBaseValue(debouncedValue)
                onChange(debouncedValue)
            }
        },
        [baseValue, debouncedValue, onChange, setBaseValue]
    )
    useEffect(() => (() => {
        if (!deepEqual(baseValue, currentValue)) {
            onChange(currentValue)
        }
    }), [])
    return [currentValue, setCurrentValue]
}

export default useDebounce
