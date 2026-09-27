import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import type { ShortNameHost } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'

import { createWorkbenchLiteralField } from './createWorkbenchLiteralField'

export type WorkbenchShortNameFieldProps = {
    label?: string
    placeholder?: string
    size?: 'small' | 'medium'
    readonly?: boolean
}

// Every StandardComponent already extends ShortNameHost (mtw-wml slice 1),
// so this guard is unconditionally true -- no kind can fail it.
const shortNameHostGuard = (
    component: StandardComponent
): component is StandardComponent & ShortNameHost => true

/**
 * Context-only shortName field for component editor sessions (D4).
 * Requires WorkbenchComponentProvider; updates working via setComponent (no updateStandard).
 */
export const WorkbenchShortNameField = createWorkbenchLiteralField<
    StandardComponent & ShortNameHost
>({
    hostGuard: shortNameHostGuard,
    read: (host) => host.shortName,
    write: (host, literal) => host.withShortName(literal),
    label: 'Short Name',
    placeholder: 'Enter short name...'
})

export default WorkbenchShortNameField
