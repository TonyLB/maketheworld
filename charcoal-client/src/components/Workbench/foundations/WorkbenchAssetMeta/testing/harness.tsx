/**
 * @vitest-environment jsdom
 *
 * Shared test utilities for useWorkbenchAssetMeta session tests.
 */

import React from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    WorkbenchAssetMetaProvider,
    useWorkbenchAssetMeta,
    type WorkbenchAssetMetaSession
} from '../useWorkbenchAssetMeta'
import { seedWorkbenchAsset, updateStandardMock } from './mock'

export {
    resetWorkbenchAssetMock,
    seedWorkbenchAsset,
    updateStandardMock,
    applyLastFlushToCommitted,
    applyLastUpdateStandardMock,
    getFlushedAssetMetaShortName,
    getFlushedTopLevelUniversalKeys,
    mockWorkbenchReturn
} from './mock'

export type WorkbenchAssetMetaHarnessOptions = {
    wml: string | StandardForm
    readonly?: boolean
    flushDelayMs?: number
    onSuperseded?: () => void
}

export type RenderWorkbenchAssetMetaSessionResult = RenderResult & {
    updateStandardMock: typeof updateStandardMock
    getSession: () => WorkbenchAssetMetaSession
    setCommittedWml: (wml: string | StandardForm) => void
}

function HookProbe({
    sessionRef
}: {
    sessionRef: React.MutableRefObject<WorkbenchAssetMetaSession | null>
}): null {
    const session = useWorkbenchAssetMeta()
    sessionRef.current = session
    return null
}

type SessionHarnessTreeProps = {
    flushDelayMs?: number
    onSuperseded?: () => void
    sessionRef: React.MutableRefObject<WorkbenchAssetMetaSession | null>
    children?: React.ReactNode
}

const SessionHarnessTree = ({
    flushDelayMs,
    onSuperseded,
    sessionRef,
    children
}: SessionHarnessTreeProps): React.ReactElement => (
    <WorkbenchAssetMetaProvider flushDelayMs={flushDelayMs} onSuperseded={onSuperseded}>
        <HookProbe sessionRef={sessionRef} />
        {children}
    </WorkbenchAssetMetaProvider>
)

export function renderWorkbenchAssetMetaSession({
    options,
    children
}: {
    options: WorkbenchAssetMetaHarnessOptions
    children?: React.ReactNode
}): RenderWorkbenchAssetMetaSessionResult {
    seedWorkbenchAsset(options.wml, options.readonly ?? false)

    const sessionRef: React.MutableRefObject<WorkbenchAssetMetaSession | null> = {
        current: null
    }

    const view = render(
        <SessionHarnessTree
            flushDelayMs={options.flushDelayMs}
            onSuperseded={options.onSuperseded}
            sessionRef={sessionRef}
        >
            {children}
        </SessionHarnessTree>
    )

    const getSession = (): WorkbenchAssetMetaSession => {
        if (!sessionRef.current) {
            throw new Error('Workbench asset-meta session not initialized')
        }
        return sessionRef.current
    }

    const setCommittedWml = (wml: string | StandardForm): void => {
        seedWorkbenchAsset(wml, options.readonly ?? false)
        view.rerender(
            <SessionHarnessTree
                flushDelayMs={options.flushDelayMs}
                onSuperseded={options.onSuperseded}
                sessionRef={sessionRef}
            >
                {children}
            </SessionHarnessTree>
        )
    }

    return {
        ...view,
        updateStandardMock,
        getSession,
        setCommittedWml
    }
}
