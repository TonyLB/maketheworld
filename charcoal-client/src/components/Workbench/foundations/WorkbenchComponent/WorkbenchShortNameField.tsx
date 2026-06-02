import React, { FunctionComponent, useCallback, useMemo } from 'react'

import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import { TopLevelStandardLiteralEditor } from '../StandardLiteral'
import { literalPlainString, setWorkingShortNameFromString } from '../workbenchMutations'
import { useWorkbenchComponent } from './useWorkbenchComponent'

export type WorkbenchShortNameFieldProps = {
    label?: string
    placeholder?: string
    size?: 'small' | 'medium'
    readonly?: boolean
}

/**
 * Context-only shortName field for component editor sessions (D4).
 * Requires WorkbenchComponentProvider; updates working via updateComponent (no updateStandard).
 */
export const WorkbenchShortNameField: FunctionComponent<WorkbenchShortNameFieldProps> = ({
    label = 'Short Name',
    placeholder = 'Enter short name...',
    size = 'small',
    readonly: readonlyProp = false
}) => {
    const { working, updateComponent, readonly: sessionReadonly, missing } =
        useWorkbenchComponent()

    const displayLiteral = useMemo(
        () => working?.shortName ?? new StandardLiteral(''),
        [working?.shortName]
    )

    const isReadonly = readonlyProp || sessionReadonly

    const handleChange = useCallback(
        (newLiteral: StandardLiteral) => {
            updateComponent((draft) => {
                setWorkingShortNameFromString(draft, literalPlainString(newLiteral))
            })
        },
        [updateComponent]
    )

    if (missing || !working) {
        return null
    }

    return (
        <TopLevelStandardLiteralEditor
            value={displayLiteral}
            onChange={handleChange}
            label={label}
            placeholder={placeholder}
            size={size}
            readonly={isReadonly}
            debounce={false}
        />
    )
}

export default WorkbenchShortNameField
