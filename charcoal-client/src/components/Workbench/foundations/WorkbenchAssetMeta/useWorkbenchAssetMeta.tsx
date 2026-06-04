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
import { push } from '../../../../slices/UI/feedback'
import { applyAssetMetaFlush } from '../consistency'
import {
    assetMetaWorkingEquals,
    prepareAssetMetaForFlush,
    projectAssetMetaFromStandardForm,
    reconcileCommittedAssetMeta,
    type WorkbenchAssetMetaWorking
} from '../workbenchMutations'
import { useWorkbenchAsset } from '../useWorkbenchAsset'
import type {
    WorkbenchAssetMetaProviderProps,
    WorkbenchAssetMetaSession
} from './baseClasses'

export type { WorkbenchAssetMetaProviderProps, WorkbenchAssetMetaSession } from './baseClasses'

const cloneAssetMetaWorking = (meta: WorkbenchAssetMetaWorking): WorkbenchAssetMetaWorking => ({
    shortName: meta.shortName?.clone(),
    summary: meta.summary?.clone(),
    topLevel: meta.topLevel.clone()
})

const SUPERSEDED_MESSAGE =
    'This asset was updated elsewhere; unsaved changes on this screen were discarded.'

type WorkbenchAssetMetaContextValue = WorkbenchAssetMetaSession

const WorkbenchAssetMetaContext = createContext<WorkbenchAssetMetaContextValue | undefined>(
    undefined
)

export const WorkbenchAssetMetaProvider = ({
    flushDelayMs = 1000,
    onSuperseded,
    children
}: WorkbenchAssetMetaProviderProps): React.ReactElement => {
    const dispatch = useDispatch()
    const { localStandardForm, updateStandard, readonly } = useWorkbenchAsset()

    const committed = useMemo(
        () => projectAssetMetaFromStandardForm(localStandardForm),
        [localStandardForm]
    )

    const [working, setWorking] = useState<WorkbenchAssetMetaWorking | undefined>(() =>
        cloneAssetMetaWorking(committed)
    )
    const [lastReceived, setLastReceived] = useState<WorkbenchAssetMetaWorking | undefined>(() =>
        cloneAssetMetaWorking(committed)
    )

    const workingRef = useRef<WorkbenchAssetMetaWorking | undefined>(working)
    const lastReceivedRef = useRef<WorkbenchAssetMetaWorking | undefined>(lastReceived)
    const lastFlushRef = useRef<WorkbenchAssetMetaWorking | undefined>(undefined)
    const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const performFlushRef = useRef<(() => void) | undefined>(undefined)
    const cancelPendingFlushRef = useRef<(() => void) | undefined>(undefined)
    const scheduleDebouncedFlushRef = useRef<(() => void) | undefined>(undefined)
    const prevCommittedRef = useRef<WorkbenchAssetMetaWorking | undefined>(undefined)
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
        (current: WorkbenchAssetMetaWorking) => {
            updateStandard({
                type: 'updateLocal',
                update: (draft) => {
                    const flushed = applyAssetMetaFlush(draft, { working: current })
                    lastFlushRef.current = flushed
                    return draft
                }
            })
        },
        [updateStandard]
    )

    const performFlush = useCallback(() => {
        const current = workingRef.current
        const received = lastReceivedRef.current
        if (!current || !received) {
            return
        }

        if (assetMetaWorkingEquals(received, current)) {
            return
        }

        const flushed = prepareAssetMetaForFlush(current)
        if (assetMetaWorkingEquals(received, flushed)) {
            return
        }

        dispatchFlush(current)

        const nextReceived = cloneAssetMetaWorking(flushed)
        lastReceivedRef.current = nextReceived
        setLastReceived(nextReceived)
    }, [dispatchFlush])

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
        lastFlushRef.current = undefined
    }, [localStandardForm.universalKey])

    useEffect(() => {
        const received = cloneAssetMetaWorking(committed)
        const nextWorking = cloneAssetMetaWorking(committed)
        const alreadySynced =
            workingRef.current !== undefined &&
            lastReceivedRef.current !== undefined &&
            assetMetaWorkingEquals(workingRef.current, nextWorking) &&
            assetMetaWorkingEquals(lastReceivedRef.current, received)

        if (!alreadySynced) {
            setLastReceived(received)
            lastReceivedRef.current = received
            setWorking(nextWorking)
            workingRef.current = nextWorking
        }

        return () => {
            cancelPendingFlushRef.current?.()
            performFlushRef.current?.()
        }
    }, [localStandardForm.universalKey])

    useEffect(() => {
        const prev = prevCommittedRef.current
        prevCommittedRef.current = committed

        if (skipCommittedSyncRef.current) {
            skipCommittedSyncRef.current = false
            return
        }

        const committedChanged =
            prev === undefined || !assetMetaWorkingEquals(prev, committed)

        if (!committedChanged) {
            return
        }

        const incoming = cloneAssetMetaWorking(committed)
        const lastFlush = lastFlushRef.current

        if (lastFlush && assetMetaWorkingEquals(incoming, lastFlush)) {
            return
        }

        cancelPendingFlush()

        const result = reconcileCommittedAssetMeta({
            committedBase: localStandardForm,
            lastReceived: lastReceivedRef.current,
            working: workingRef.current
        })

        const workingChanged =
            result.working === undefined
                ? workingRef.current !== undefined
                : workingRef.current === undefined ||
                  !assetMetaWorkingEquals(workingRef.current, result.working)
        const lastReceivedChanged =
            result.lastReceived === undefined
                ? lastReceivedRef.current !== undefined
                : lastReceivedRef.current === undefined ||
                  !assetMetaWorkingEquals(lastReceivedRef.current, result.lastReceived)

        if (workingChanged) {
            workingRef.current = result.working
            setWorking(result.working)
        }
        if (lastReceivedChanged) {
            lastReceivedRef.current = result.lastReceived
            setLastReceived(result.lastReceived)
        }

        if (result.superseded) {
            notifySuperseded()
        }

        if (workingChanged || lastReceivedChanged) {
            scheduleDebouncedFlush()
        }
    }, [
        committed,
        localStandardForm,
        cancelPendingFlush,
        scheduleDebouncedFlush,
        notifySuperseded
    ])

    const updateAssetMeta = useCallback(
        (updater: (draft: WorkbenchAssetMetaWorking) => void) => {
            const current = workingRef.current
            if (!current || readonly) {
                return
            }
            const next = cloneAssetMetaWorking(current)
            updater(next)
            workingRef.current = next
            setWorking(next)
            scheduleDebouncedFlush()
        },
        [readonly, scheduleDebouncedFlush]
    )

    const isDirty = useMemo(() => {
        if (!lastReceived || !working) {
            return false
        }
        return !assetMetaWorkingEquals(lastReceived, working)
    }, [lastReceived, working])

    const session = useMemo<WorkbenchAssetMetaSession>(
        () => ({
            working,
            lastReceived,
            committed,
            updateAssetMeta,
            flushToStandardForm,
            flushNow,
            isDirty,
            readonly
        }),
        [
            working,
            lastReceived,
            committed,
            updateAssetMeta,
            flushToStandardForm,
            flushNow,
            isDirty,
            readonly
        ]
    )

    return (
        <WorkbenchAssetMetaContext.Provider value={session}>
            {children}
        </WorkbenchAssetMetaContext.Provider>
    )
}

export const useWorkbenchAssetMetaContext = (): WorkbenchAssetMetaSession => {
    const context = useContext(WorkbenchAssetMetaContext)
    if (context === undefined) {
        throw new Error(
            'useWorkbenchAssetMetaContext must be used within WorkbenchAssetMetaProvider'
        )
    }
    return context
}

export const useWorkbenchAssetMeta = (): WorkbenchAssetMetaSession =>
    useWorkbenchAssetMetaContext()
