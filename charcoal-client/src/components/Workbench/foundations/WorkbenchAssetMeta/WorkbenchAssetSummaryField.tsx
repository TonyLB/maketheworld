import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { Box, Typography } from '@mui/material'

import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

import { StandardRenderEditor } from '../StandardRender'
import { setWorkingAssetSummary } from '../workbenchMutations'
import { useWorkbenchAssetMeta } from './useWorkbenchAssetMeta'

export type WorkbenchAssetSummaryFieldProps = {
    readonly?: boolean
}

/**
 * Context-only asset Summary field (D11).
 * Requires WorkbenchAssetMetaProvider; updates working via updateAssetMeta (no updateStandard).
 */
export const WorkbenchAssetSummaryField: FunctionComponent<WorkbenchAssetSummaryFieldProps> = ({
    readonly: readonlyProp = false
}) => {
    const { working, updateAssetMeta, readonly: sessionReadonly } = useWorkbenchAssetMeta()

    const displaySummary = useMemo(
        () => working?.summary ?? new StandardRender([]),
        [working?.summary]
    )

    const isReadonly = readonlyProp || sessionReadonly

    const handleChange = useCallback(
        (value: StandardRender) => {
            updateAssetMeta((draft) => {
                setWorkingAssetSummary(draft, value)
            })
        },
        [updateAssetMeta]
    )

    if (!working) {
        return null
    }

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ marginBottom: '0.5em' }}>
                Summary
            </Typography>
            <Box
                sx={{
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '4px',
                    padding: '0.5em'
                }}
            >
                <StandardRenderEditor
                    value={displaySummary}
                    onChange={handleChange}
                    validLinkTags={[]}
                    toolbar={false}
                    tag="Summary"
                    debounce={false}
                />
            </Box>
        </Box>
    )
}

export default WorkbenchAssetSummaryField
