import React, { FunctionComponent } from 'react'
import InlineChromiumBugfix from '../../../lib/slateUtils'
import { RenderElementProps } from 'slate-react'
import { DescriptionLinkFeatureChip } from '../../Message/DescriptionLink'

import Box from '@mui/material/Box'

export const Element: FunctionComponent<RenderElementProps> = (props) => {
    const { attributes, children, element } = props
    switch(element.type) {
        case 'featureLink':
            return <span {...attributes}>
                <DescriptionLinkFeatureChip tooltipTitle={`Feature: ${element.to}`}>
                    <InlineChromiumBugfix />
                    {children}
                    <InlineChromiumBugfix />
                </DescriptionLinkFeatureChip>
            </span>
        case 'knowledgeLink':
            return <span {...attributes}>
                <DescriptionLinkFeatureChip tooltipTitle={`Knowledge: ${element.to}`}>
                    <InlineChromiumBugfix />
                    {children}
                    <InlineChromiumBugfix />
                </DescriptionLinkFeatureChip>
            </span>
        case 'paragraph':
            return (
                <Box
                    {...attributes}
                    component="p"
                    sx={{ marginBottom: '0.5em', '&:last-child': { marginBottom: 0 } }}
                >
                    {children}
                </Box>
            )
        default: return (
            <div {...attributes}>
                {children}
            </div>
        )
    }
}
