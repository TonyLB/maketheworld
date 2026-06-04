import React, { FunctionComponent, useCallback, useMemo } from 'react'

import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import { TopLevelStandardLiteralEditor } from '../StandardLiteral'
import { setWorkingAssetShortNameFromLiteral } from '../workbenchMutations'
import { useWorkbenchAssetMeta } from './useWorkbenchAssetMeta'

export type WorkbenchAssetShortNameFieldProps = {
    label?: string
    placeholder?: string
    size?: 'small' | 'medium'
    readonly?: boolean
}

/**
 * Context-only asset ShortName field (D11).
 * Requires WorkbenchAssetMetaProvider; updates working via updateAssetMeta (no updateStandard).
 */
export const WorkbenchAssetShortNameField: FunctionComponent<WorkbenchAssetShortNameFieldProps> = ({
    label = 'Short Name',
    placeholder = 'Enter a short name for this draft',
    size = 'medium',
    readonly: readonlyProp = false
}) => {
    const { working, updateAssetMeta, readonly: sessionReadonly } = useWorkbenchAssetMeta()

    const displayLiteral = useMemo(
        () => working?.shortName ?? new StandardLiteral(''),
        [working?.shortName]
    )

    const isReadonly = readonlyProp || sessionReadonly

    const handleChange = useCallback(
        (newLiteral: StandardLiteral) => {
            updateAssetMeta((draft) => {
                setWorkingAssetShortNameFromLiteral(draft, newLiteral)
            })
        },
        [updateAssetMeta]
    )

    if (!working) {
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

export default WorkbenchAssetShortNameField
