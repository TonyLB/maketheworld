import React, { ReactChild, ReactChildren, ReactElement } from 'react'

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
    KnowledgeDescription as KnowledgeDescriptionType
} from '@tonylb/mtw-interfaces/ts/messages'

import RenderTreeContent from './RenderTreeContent'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

type ComponentDescriptionProps<T extends FeatureDescriptionType | KnowledgeDescriptionType> = {
    message: T;
    children?: ReactChild | ReactChildren;
    icon: ReactElement;
    bevel?: string;
    onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraActionId | EphemeraCharacterId) => void;
    toolActions?: ReactElement;
}

export const ComponentDescription = <T extends FeatureDescriptionType | KnowledgeDescriptionType>({ message, icon, bevel, onClickLink, toolActions }: ComponentDescriptionProps<T>) => {
    const { Description, Name } = message
    const standardName = new StandardRender(Name)
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
            toolActions={toolActions}
        >
            <Box
                sx={{
                    gridArea: 'content',
                    paddingBottom: '5px'
                }}
            >
                <Typography variant='h5' align='left'>
                    { standardName.plainString }
                </Typography>
                <Divider />
                {
                    Description.length
                        ? <RenderTreeContent list={Description} onClickLink={onClickLink} />
                        : <em>No description</em>
                }
            </Box>
        </MessageComponent>
}

export default ComponentDescription
