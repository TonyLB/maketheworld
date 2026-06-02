import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'

import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { useWorkbenchAsset } from '../useWorkbenchAsset'
import type {
    WorkbenchComponentGuard,
    WorkbenchComponentProviderProps,
    WorkbenchComponentSession
} from './baseClasses'

export type {
    WorkbenchComponentGuard,
    WorkbenchComponentProviderProps,
    WorkbenchComponentSession
} from './baseClasses'

const defaultGuard = <T extends StandardComponent>(
    component: StandardComponent | undefined
): component is T => component !== undefined

const resolveCommitted = <T extends StandardComponent>(
    standardForm: ReturnType<typeof useWorkbenchAsset>['standardForm'],
    componentId: ComponentUUID,
    guard: WorkbenchComponentGuard<T> | undefined
): { committed: T | undefined; missing: boolean } => {
    const raw = standardForm.byUniversalId[componentId]
    if (raw === undefined) {
        return { committed: undefined, missing: true }
    }
    const typeGuard = guard ?? defaultGuard<T>
    if (!typeGuard(raw)) {
        return { committed: undefined, missing: true }
    }
    return { committed: raw, missing: false }
}

type WorkbenchComponentContextValue<T extends StandardComponent> = WorkbenchComponentSession<T>

const WorkbenchComponentContext = createContext<
    WorkbenchComponentContextValue<StandardComponent> | undefined
>(undefined)

export const WorkbenchComponentProvider = <T extends StandardComponent>({
    componentId,
    guard,
    flushDelayMs: _flushDelayMs = 1000,
    children
}: WorkbenchComponentProviderProps<T>): React.ReactElement => {
    const { standardForm, readonly } = useWorkbenchAsset()
    const { committed, missing } = useMemo(
        () => resolveCommitted<T>(standardForm, componentId, guard),
        [standardForm, componentId, guard]
    )

    const [working, setWorking] = useState<T | undefined>(() =>
        committed ? (committed.clone() as T) : undefined
    )
    const [lastReceived, setLastReceived] = useState<T | undefined>(() =>
        committed ? (committed.clone() as T) : undefined
    )
    // Mirror of `working` for imperative reads: debounced flush and stable updateComponent
    // callbacks must read the latest clone without closing over stale render state (D14c).
    const workingRef = useRef<T | undefined>(working)

    useEffect(() => {
        if (missing || !committed) {
            setWorking(undefined)
            setLastReceived(undefined)
            workingRef.current = undefined
            return
        }
        const received = committed.clone() as T
        setLastReceived(received)
        const nextWorking = received.clone() as T
        setWorking(nextWorking)
        workingRef.current = nextWorking
    }, [componentId]) // mount / componentId only; D14 external reconcile in slice 399

    const updateComponent = useCallback(
        (updater: (draft: T) => void) => {
            const current = workingRef.current
            if (!current || missing) {
                return
            }
            const next = current.clone() as T
            updater(next)
            workingRef.current = next // sync before setWorking; flush timers read the ref
            setWorking(next)
            // slice 399: reset debounce timer here (D8a)
        },
        [missing]
    )

    // slice 399: debounced flushToStandardForm + D2 assign via updateStandard
    const flushToStandardForm = useCallback(() => {}, [])

    // slice 399: bypass debounce and flush workingRef to Redux
    const flushNow = useCallback(() => {}, [])

    const isDirty = useMemo(() => {
        if (!lastReceived || !working) {
            return false
        }
        return lastReceived.diff(working) !== undefined
    }, [lastReceived, working])

    const session = useMemo<WorkbenchComponentSession<T>>(
        () => ({
            componentId,
            working,
            lastReceived,
            committed,
            updateComponent,
            flushToStandardForm,
            flushNow,
            isDirty,
            readonly,
            missing
        }),
        [
            componentId,
            working,
            lastReceived,
            committed,
            updateComponent,
            flushToStandardForm,
            flushNow,
            isDirty,
            readonly,
            missing
        ]
    )

    return (
        <WorkbenchComponentContext.Provider
            value={session as WorkbenchComponentContextValue<StandardComponent>}
        >
            {children}
        </WorkbenchComponentContext.Provider>
    )
}

export const useWorkbenchComponentContext = <
    T extends StandardComponent = StandardComponent
>(): WorkbenchComponentSession<T> => {
    const context = useContext(WorkbenchComponentContext)
    if (context === undefined) {
        throw new Error('useWorkbenchComponentContext must be used within WorkbenchComponentProvider')
    }
    return context as WorkbenchComponentSession<T>
}

export const useWorkbenchComponent = <
    T extends StandardComponent = StandardComponent
>(): WorkbenchComponentSession<T> => useWorkbenchComponentContext<T>()
