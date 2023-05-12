/** @jsxImportSource @emotion/react */
import { ReactChild, ReactChildren, ReactElement } from 'react'
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
    KnowledgeDescription as KnowledgeDescriptionType,
    isTaggedText
} from '@tonylb/mtw-interfaces/dist/messages'

import TaggedMessageContent from './TaggedMessageContent'

type ComponentDescriptionProps<T extends FeatureDescriptionType | KnowledgeDescriptionType> = {
    message: T;
    children?: ReactChild | ReactChildren;
    icon: ReactElement;
    bevel?: string;
}

export const ComponentDescription = <T extends FeatureDescriptionType | KnowledgeDescriptionType>({ message, icon, bevel }: ComponentDescriptionProps<T>) => {
    const { Description, Name } = message
    const bevelCSS = bevel
        ? `polygon(
            0% ${bevel},
            ${bevel} 0%,
            calc(100% - ${bevel}) 0%,
            100% ${bevel},
            100% calc(100% - ${bevel}),
            calc(100% - ${bevel}) 100%,
            ${bevel} 100%,
            0 calc(100% - ${bevel})
        )`
        : ''
    return <MessageComponent
            sx={{
                paddingTop: "10px",
                paddingBottom: "10px",
                marginRight: "75px",
                marginLeft: "75px",
                background: `linear-gradient(${grey[100]}, ${grey[300]})`,
                color: (theme) => (theme.palette.getContrastText(blue[200])),
                ...(bevel ? { clipPath: bevelCSS } : {})
            }}
            leftIcon={icon}
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

export default ComponentDescription
