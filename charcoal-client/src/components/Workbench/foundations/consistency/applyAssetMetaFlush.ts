import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    applyWorkingAssetMetaToDraft,
    type WorkbenchAssetMetaWorking
} from '../workbenchMutations'

export type { WorkbenchAssetMetaWorking } from '../workbenchMutations'

export type ApplyAssetMetaFlushEdit = {
    working: WorkbenchAssetMetaWorking
    beforeAssign?: (draft: StandardForm, working: WorkbenchAssetMetaWorking) => void
}

/**
 * Asset-meta flush pipeline (D11): apply session working to a local draft clone.
 * Assign only (optional beforeAssign, then applyWorkingAssetMetaToDraft).
 * Does not materialize or run orphan GC. Mutates draft in place.
 */
export function applyAssetMetaFlush(
    draft: StandardForm,
    edit: ApplyAssetMetaFlushEdit
): WorkbenchAssetMetaWorking {
    edit.beforeAssign?.(draft, edit.working)
    return applyWorkingAssetMetaToDraft(draft, edit.working)
}
