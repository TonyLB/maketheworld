import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { isGlossHost, type GlossHost } from '@tonylb/mtw-wml/ts/standardize/components/glossField'

import { createWorkbenchLiteralField } from './createWorkbenchLiteralField'

export type WorkbenchGlossFieldProps = {
    label?: string
    placeholder?: string
    size?: 'small' | 'medium'
    readonly?: boolean
}

/**
 * Context-only gloss field for component editor sessions.
 * Requires WorkbenchComponentProvider; updates working via setComponent (no updateStandard).
 * Unlike ShortName, not every StandardComponent hosts Gloss, so this guard is the real
 * isGlossHost narrowing -- mounting on a non-hosting kind throws via the factory's backstop.
 */
export const WorkbenchGlossField = createWorkbenchLiteralField<
    StandardComponent & GlossHost
>({
    hostGuard: isGlossHost,
    read: (host) => host.gloss,
    write: (host, literal) => host.withGloss(literal),
    label: 'Gloss',
    placeholder: 'A physical description for reasoning only -- players never see this.'
})

export default WorkbenchGlossField
