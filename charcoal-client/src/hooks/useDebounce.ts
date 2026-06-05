import { useState, useEffect } from 'react'
import { deepEqual } from '../lib/objects'
import type { ScopedInstrumentationOptions } from '../testing/scopedInstrumentation'

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

//
// TODO: Refactor useDebouncedOnChange to return value and "force" function that bypasses the debounce
//
export const useDebouncedOnChange = <T>({
    value,
    delay,
    onChange,
    enabled = true,
    options,
    instrumentationKey
}: {
    value: T
    delay: number
    onChange: (value: T) => void
    /** When false, debounce timers and onChange side effects are disabled (immediate editors use handleChange only). */
    enabled?: boolean
    options?: ScopedInstrumentationOptions
    instrumentationKey?: string
}): [T, (value: T) => void] => {
    const [baseValue, setBaseValue] = useState<T>(value)
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(
        () => {
            if (!enabled) {
                return
            }
            // Update debounced value after delay
            const handler = setTimeout(() => {
                setDebouncedValue(value)
            }, delay)
            // Cancel the timeout if value changes (also on delay change or unmount)
            // This is how we prevent debounced value from updating if value is changed
            // within the delay period. Timeout gets cleared and restarted.
            return () => {
                clearTimeout(handler)
            }
        },
        [enabled, value, delay] // Only re-call effect if value or delay changes
    )
    useEffect(
        () => {
            if (!enabled) {
                return
            }
            if (!deepEqual(baseValue, debouncedValue)) {
                const hasInstrumentation = !!(instrumentationKey && options?.instrumentation?.includes(instrumentationKey))
                if (hasInstrumentation) {
                    console.log(`[instrumentation:${instrumentationKey}] useDebouncedOnChange firing`, { from: baseValue, to: debouncedValue })
                } else {
                    console.log('[useDebouncedOnChange] firing (no instrumentation key)', { from: baseValue, to: debouncedValue })
                }
                onChange(debouncedValue)
                setBaseValue(debouncedValue)
            }
        },
        [enabled, baseValue, debouncedValue, onChange, setBaseValue, instrumentationKey, options]
    )
    return [debouncedValue, (value) => {
        onChange(value)
        setBaseValue(value)
    }]
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
