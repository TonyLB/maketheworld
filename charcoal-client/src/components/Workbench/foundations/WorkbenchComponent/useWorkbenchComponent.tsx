import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import { useDispatch } from 'react-redux'

import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { push } from '../../../../slices/UI/feedback'
import {
    assureDefaultSituationFromPrimitives,
    DEFAULT_SITUATION_ID
} from '../../../../slices/personalAssets'
import { fetchImports } from '../../../../slices/personalAssets/index.api'
import {
    applyWorkingComponentToDraft,
    findSituationFacet,
    isSituationProseParent,
    prepareComponentForFlush,
    reconcileCommittedComponent
} from '../workbenchMutations'
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

const SUPERSEDED_MESSAGE =
    'This component was updated elsewhere; unsaved changes on this screen were discarded.'

export const WorkbenchComponentProvider = <T extends StandardComponent>({
    componentId,
    guard,
    flushDelayMs = 1000,
    onSuperseded,
    children
}: WorkbenchComponentProviderProps<T>): React.ReactElement => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly, AssetId } = useWorkbenchAsset()
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
    const lastReceivedRef = useRef<T | undefined>(lastReceived)
    const lastFlushRef = useRef<T | undefined>(undefined)
    const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const performFlushRef = useRef<((overrideComponentId?: ComponentUUID) => void) | undefined>(
        undefined
    )
    const cancelPendingFlushRef = useRef<(() => void) | undefined>(undefined)
    const scheduleDebouncedFlushRef = useRef<(() => void) | undefined>(undefined)
    const prevCommittedRef = useRef<T | undefined>(undefined)
    const skipCommittedSyncRef = useRef(true)

    const notifySuperseded = useCallback(() => {
        if (onSuperseded) {
            onSuperseded()
        } else {
            dispatch(push(SUPERSEDED_MESSAGE))
        }
    }, [dispatch, onSuperseded])

    useEffect(() => {
        lastReceivedRef.current = lastReceived
    }, [lastReceived])

    const cancelPendingFlush = useCallback(() => {
        if (flushTimeoutRef.current !== undefined) {
            clearTimeout(flushTimeoutRef.current)
            flushTimeoutRef.current = undefined
        }
    }, [])

    const dispatchFlush = useCallback(
        (id: ComponentUUID, current: T) => {
            let needsFetch = false
            updateStandard({
                type: 'update',
                update: (draft) => {
                    const hasDefaultFacet =
                        isSituationProseParent(current) &&
                        findSituationFacet(current, DEFAULT_SITUATION_ID) !== undefined
                    if (hasDefaultFacet) {
                        needsFetch = assureDefaultSituationFromPrimitives(draft)
                    }
                    const flushed = applyWorkingComponentToDraft(draft, id, current)
                    lastFlushRef.current = flushed
                    return draft
                }
            })
            if (needsFetch) {
                dispatch(fetchImports(AssetId))
            }
        },
        [updateStandard, dispatch, AssetId]
    )

    const performFlush = useCallback(
        (overrideComponentId?: ComponentUUID) => {
            const current = workingRef.current
            const id = overrideComponentId ?? componentId
            if (!current) {
                return
            }
            if (overrideComponentId === undefined && missing) {
                return
            }

            const received = lastReceivedRef.current
            if (received && received.diff(current) === undefined) {
                return
            }

            const flushed = prepareComponentForFlush(current)
            if (received && received.diff(flushed) === undefined) {
                return
            }

            dispatchFlush(id, current)

            if (overrideComponentId === undefined) {
                const nextReceived = flushed.clone() as T
                lastReceivedRef.current = nextReceived
                setLastReceived(nextReceived)
            }
        },
        [componentId, missing, dispatchFlush]
    )

    const scheduleDebouncedFlush = useCallback(() => {
        cancelPendingFlush()
        flushTimeoutRef.current = setTimeout(() => {
            flushTimeoutRef.current = undefined
            performFlushRef.current?.()
        }, flushDelayMs)
    }, [cancelPendingFlush, flushDelayMs])

    const flushToStandardForm = useCallback(() => {
        scheduleDebouncedFlush()
    }, [scheduleDebouncedFlush])

    const flushNow = useCallback(() => {
        cancelPendingFlush()
        performFlush()
    }, [cancelPendingFlush, performFlush])

    useEffect(() => {
        performFlushRef.current = performFlush
        cancelPendingFlushRef.current = cancelPendingFlush
        scheduleDebouncedFlushRef.current = scheduleDebouncedFlush
    })

    useEffect(() => {
        skipCommittedSyncRef.current = true
        prevCommittedRef.current = undefined
    }, [componentId])

    useEffect(() => {
        const outgoingId = componentId
        const outgoingMissing = missing

        if (missing || !committed) {
            setWorking(undefined)
            setLastReceived(undefined)
            workingRef.current = undefined
            lastReceivedRef.current = undefined
        } else {
            const received = committed.clone() as T
            setLastReceived(received)
            lastReceivedRef.current = received
            const nextWorking = received.clone() as T
            setWorking(nextWorking)
            workingRef.current = nextWorking
        }

        return () => {
            cancelPendingFlushRef.current?.()
            if (!outgoingMissing) {
                performFlushRef.current?.(outgoingId)
            }
        }
    }, [componentId])

    useEffect(() => {
        const prev = prevCommittedRef.current
        prevCommittedRef.current = committed

        if (skipCommittedSyncRef.current) {
            skipCommittedSyncRef.current = false
            return
        }

        const committedChanged =
            (prev === undefined) !== (committed === undefined) ||
            (prev !== undefined &&
                committed !== undefined &&
                !prev.equals(committed))

        if (!committedChanged) {
            return
        }

        const incoming = missing ? undefined : (committed?.clone() as T | undefined)
        const lastFlush = lastFlushRef.current

        if (incoming && lastFlush && incoming.equals(lastFlush)) {
            return
        }

        cancelPendingFlush()

        const result = reconcileCommittedComponent({
            lastReceived: lastReceivedRef.current,
            working: workingRef.current,
            incoming
        })

        workingRef.current = result.working
        lastReceivedRef.current = result.lastReceived
        setWorking(result.working)
        setLastReceived(result.lastReceived)

        if (result.superseded) {
            notifySuperseded()
        }

        scheduleDebouncedFlush()
    }, [
        committed,
        missing,
        cancelPendingFlush,
        scheduleDebouncedFlush,
        notifySuperseded
    ])

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
            scheduleDebouncedFlush()
        },
        [missing, scheduleDebouncedFlush]
    )

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
