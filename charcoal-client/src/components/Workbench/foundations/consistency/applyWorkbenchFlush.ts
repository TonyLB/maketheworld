import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { applyWorkingComponentToDraft } from '../workbenchMutations'
import { normalizeWorkbenchDraft } from './normalizeWorkbenchDraft'

export type ApplyWorkbenchFlushEdit<T extends StandardComponent = StandardComponent> = {
    componentId: ComponentUUID
    working: T
    beforeAssign?: (draft: StandardForm, working: T) => void
}

/**
 * Workbench flush pipeline (D10): apply session working to a local draft clone,
 * then normalize. Does not materialize. Mutates draft in place.
 */
export function applyWorkbenchFlush<T extends StandardComponent>(
    draft: StandardForm,
    edit: ApplyWorkbenchFlushEdit<T>
): T {
    edit.beforeAssign?.(draft, edit.working)
    const flushed = applyWorkingComponentToDraft(draft, edit.componentId, edit.working)
    normalizeWorkbenchDraft(draft)
    return flushed
}
