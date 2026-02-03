import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Box, Typography } from '@mui/material'

import { useWorkbenchAsset } from '../useWorkbenchAsset'
import { getBreadcrumbStack, replaceTopBreadcrumb } from '../../../../slices/UI/workbench'
import { getLayeredContext } from './layeredContextUtils'
import { LayeredTabs } from './LayeredTabs'
import ExampleEditor from '../../ExampleEdit/ExampleEditor'
import GuidanceEditor from '../../GuidanceEdit/GuidanceEditor'

/**
 * Renders the layered tab UI (tabs + editor) when the breadcrumb stack represents
 * a sibling group (e.g. Room → Example or Room → Guidance). Returns null otherwise.
 * Example and Guidance can also appear as top-level components (no siblings); in that
 * case WorkbenchAssetEditor renders ExampleEditor/GuidanceEditor directly in the component section.
 */
export const LayeredContextView: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm } = useWorkbenchAsset()
    const stack = useSelector(getBreadcrumbStack)
    const context = getLayeredContext(standardForm, stack)

    if (!context) return null

    if (context.siblings.length === 0) {
        const message =
            context.tag === 'Guidance'
                ? 'No guidance defined. Add guidance in the Room editor.'
                : 'This component has no Examples yet.'
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    {message}
                </Typography>
            </Box>
        )
    }

    return (
        <LayeredTabs
            siblings={context.siblings}
            currentId={context.currentId}
            onChange={(id) => dispatch(replaceTopBreadcrumb(id))}
        >
            <Box sx={{ padding: 2 }}>
                {context.tag === 'Example' ? (
                    <ExampleEditor />
                ) : (
                    <GuidanceEditor />
                )}
            </Box>
        </LayeredTabs>
    )
}

export default LayeredContextView
