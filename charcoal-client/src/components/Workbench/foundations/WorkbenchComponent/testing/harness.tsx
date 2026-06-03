/**
 * @vitest-environment jsdom
 *
 * Shared test utilities for useWorkbenchComponent session tests.
 */

import React from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import {
    WorkbenchComponentProvider,
    useWorkbenchComponent,
    type WorkbenchComponentGuard,
    type WorkbenchComponentSession
} from '../useWorkbenchComponent'
import {
    seedWorkbenchAsset,
    updateStandardMock
} from './mock'

export {
    resetWorkbenchAssetMock,
    seedWorkbenchAsset,
    updateStandardMock,
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset,
    mockMaterializeComponentInAssetImport
} from './mock'

export type WorkbenchComponentHarnessOptions<T extends StandardComponent> = {
    wml: string | StandardForm
    componentId: ComponentUUID
    guard?: WorkbenchComponentGuard<T>
    readonly?: boolean
    flushDelayMs?: number
    onSuperseded?: () => void
}

export type RenderWorkbenchComponentSessionResult<T extends StandardComponent> = RenderResult & {
    updateStandardMock: typeof updateStandardMock
    getSession: () => WorkbenchComponentSession<T>
    setCommittedWml: (wml: string | StandardForm) => void
    rerenderWithComponentId: (componentId: ComponentUUID) => void
}

function HookProbe<T extends StandardComponent>({
    sessionRef
}: {
    sessionRef: React.MutableRefObject<WorkbenchComponentSession<T> | null>
}): null {
    const session = useWorkbenchComponent<T>()
    sessionRef.current = session
    return null
}

type SessionHarnessTreeProps<T extends StandardComponent> = {
    componentId: ComponentUUID
    guard?: WorkbenchComponentGuard<T>
    flushDelayMs?: number
    onSuperseded?: () => void
    sessionRef: React.MutableRefObject<WorkbenchComponentSession<T> | null>
    children?: React.ReactNode
}

const SessionHarnessTree = <T extends StandardComponent>({
    componentId,
    guard,
    flushDelayMs,
    onSuperseded,
    sessionRef,
    children
}: SessionHarnessTreeProps<T>): React.ReactElement => (
    <WorkbenchComponentProvider
        componentId={componentId}
        guard={guard}
        flushDelayMs={flushDelayMs}
        onSuperseded={onSuperseded}
    >
        <HookProbe<T> sessionRef={sessionRef} />
        {children}
    </WorkbenchComponentProvider>
)

export function renderWorkbenchComponentSession<T extends StandardComponent>({
    options,
    children
}: {
    options: WorkbenchComponentHarnessOptions<T>
    children?: React.ReactNode
}): RenderWorkbenchComponentSessionResult<T> {
    seedWorkbenchAsset(options.wml, options.readonly ?? false)

    const sessionRef: React.MutableRefObject<WorkbenchComponentSession<T> | null> = {
        current: null
    }
    let currentComponentId = options.componentId

    const renderTree = (componentId: ComponentUUID) =>
        render(
            <SessionHarnessTree<T>
                componentId={componentId}
                guard={options.guard}
                flushDelayMs={options.flushDelayMs}
                onSuperseded={options.onSuperseded}
                sessionRef={sessionRef}
            >
                {children}
            </SessionHarnessTree>
        )

    const view = renderTree(currentComponentId)

    const getSession = (): WorkbenchComponentSession<T> => {
        if (!sessionRef.current) {
            throw new Error('Workbench component session not initialized')
        }
        return sessionRef.current
    }

    const rerenderHarness = (componentId: ComponentUUID): void => {
        view.rerender(
            <SessionHarnessTree<T>
                componentId={componentId}
                guard={options.guard}
                flushDelayMs={options.flushDelayMs}
                onSuperseded={options.onSuperseded}
                sessionRef={sessionRef}
            >
                {children}
            </SessionHarnessTree>
        )
    }

    const setCommittedWml = (wml: string | StandardForm): void => {
        seedWorkbenchAsset(wml, options.readonly ?? false)
        rerenderHarness(currentComponentId)
    }

    const rerenderWithComponentId = (componentId: ComponentUUID): void => {
        currentComponentId = componentId
        rerenderHarness(componentId)
    }

    return {
        ...view,
        updateStandardMock,
        getSession,
        setCommittedWml,
        rerenderWithComponentId
    }
}
