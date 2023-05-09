/** @jsxImportSource @emotion/react */
import React, { ReactChild, ReactChildren } from 'react'
import { css } from '@emotion/react'

import {
    Box,
    Typography,
    Divider
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'
import FeatureIcon from '@mui/icons-material/Search'

import MessageComponent from './MessageComponent'
import {
    FeatureDescription as FeatureDescriptionType,
    isTaggedText,
    TaggedMessageContent as TaggedMessageContentType
} from '@tonylb/mtw-interfaces/dist/messages'

import DescriptionLink from './DescriptionLink'
import TaggedMessageContent from './TaggedMessageContent'

interface FeatureDescriptionProps {
    message: FeatureDescriptionType;
    children?: ReactChild | ReactChildren;
}

const renderFeatureDescriptionItem = (item: TaggedMessageContentType, index: number) => {
    switch(item.tag) {
        case 'Link':
            return <DescriptionLink link={item} key={index} />
        case 'String':
            return item.value
    }
}

export const FeatureDescription = ({ message }: FeatureDescriptionProps) => {
    const { Description, Name } = message
    return <MessageComponent
            sx={{
                paddingTop: "10px",
                paddingBottom: "10px",
                marginRight: "75px",
                marginLeft: "75px",
                background: `linear-gradient(${grey[100]}, ${grey[300]})`,
                color: (theme) => (theme.palette.getContrastText(blue[200]))
            }}
            leftIcon={<FeatureIcon />}
        >
            <Box css={css`
                grid-area: content;
                padding-bottom: 5px;
            `}>
                <Typography variant='h5' align='left'>
                    { Name.filter(isTaggedText).map(({ value }) => (value)).join('') }
                </Typography>
                <Divider />
                {
                    Description.length
                        ? <TaggedMessageContent list={Description} />
                        : <em>No description</em>
                }
            </Box>
        </MessageComponent>
}

export default FeatureDescription
