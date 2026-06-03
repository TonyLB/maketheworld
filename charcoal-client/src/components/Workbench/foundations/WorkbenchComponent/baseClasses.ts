import type { ReactNode } from 'react'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

export type WorkbenchComponentGuard<T extends StandardComponent> = (
    component: StandardComponent | undefined
) => component is T

export type WorkbenchComponentProviderProps<T extends StandardComponent> = {
    componentId: ComponentUUID
    guard?: WorkbenchComponentGuard<T>
    flushDelayMs?: number
    /** Called when external reconcile discards local edits (default: feedback snackbar). */
    onSuperseded?: () => void
    children: ReactNode
}

export type WorkbenchComponentSession<T extends StandardComponent> = {
    componentId: ComponentUUID
    working: T | undefined
    lastReceived: T | undefined
    committed: T | undefined
    updateComponent: (updater: (draft: T) => void) => void
    flushToStandardForm: () => void
    flushNow: () => void
    /** Asset-scoped persist (create/import): one updateLocal flush (beforeAssign + applyWorkbenchFlush normalize). */
    commitAssetScopedUpdate: (mutateDraft: (draft: StandardForm, working: T) => void) => void
    isDirty: boolean
    readonly: boolean
    missing: boolean
}
