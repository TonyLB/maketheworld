import type { ReactNode } from 'react'

import type { ScopedInstrumentationOptions } from '../../../../testing/scopedInstrumentation'
import type { WorkbenchAssetMetaWorking } from '../consistency'

export type WorkbenchAssetMetaProviderProps = {
    flushDelayMs?: number
    /** Scoped instrumentation (e.g. flush / reconcile). See workbenchSessionInstrumentation.ts. */
    instrumentation?: ScopedInstrumentationOptions
    /** Called when external reconcile discards local edits (default: feedback snackbar). */
    onSuperseded?: () => void
    children: ReactNode
}

export type WorkbenchAssetMetaSession = {
    working: WorkbenchAssetMetaWorking | undefined
    lastReceived: WorkbenchAssetMetaWorking | undefined
    committed: WorkbenchAssetMetaWorking | undefined
    updateAssetMeta: (updater: (draft: WorkbenchAssetMetaWorking) => void) => void
    flushToStandardForm: () => void
    flushNow: () => void
    isDirty: boolean
    readonly: boolean
}
