import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    applyWorkingAssetMetaToDraft,
    type WorkbenchAssetMetaWorking
} from '../workbenchMutations'
import { normalizeWorkbenchDraft } from './normalizeWorkbenchDraft'

export type { WorkbenchAssetMetaWorking } from '../workbenchMutations'

export type ApplyAssetMetaFlushEdit = {
    working: WorkbenchAssetMetaWorking
    beforeAssign?: (draft: StandardForm, working: WorkbenchAssetMetaWorking) => void
}

/**
 * Asset-meta flush pipeline (D11): apply session working to a local draft clone,
 * then normalize. Does not materialize. Mutates draft in place.
 */
export function applyAssetMetaFlush(
    draft: StandardForm,
    edit: ApplyAssetMetaFlushEdit
): WorkbenchAssetMetaWorking {
    edit.beforeAssign?.(draft, edit.working)
    const flushed = applyWorkingAssetMetaToDraft(draft, edit.working)
    normalizeWorkbenchDraft(draft)
    return flushed
}
