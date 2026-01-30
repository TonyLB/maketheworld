import React, { FunctionComponent } from 'react'
import InlineChromiumBugfix from '../../../lib/slateUtils'
import { RenderElementProps, RenderLeafProps } from 'slate-react'
import { DescriptionLinkFeatureChip } from '../../Message/DescriptionLink'

import Box from '@mui/material/Box'
import { NodeEntry, Range } from 'slate'

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
                    sx={{
                        display: 'inline-block',
                        verticalAlign: 'top',
                        marginRight: '0.1em'
                    }}
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

export const Leaf: FunctionComponent<RenderLeafProps> = ({ attributes, children }) => {
    //
    // Hide Slate's default br after an empty paragraph block, so it can be used as a placeholder
    // in a horizontal layout with other blocks
    //
    return (
        <Box
            component="span"
            {...attributes}
            sx={{
                [`& span[data-slate-length=0]`]: {
                    marginRight: '0.25em',
                    '& br': {
                        display: 'none'
                    }
                }
            }}
        >
            {children}
        </Box>
    )
}

export const decorateFactory = () =>
    (_entry: NodeEntry): (Range & { highlight?: boolean })[] => []
