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
    KnowledgeDescription as KnowledgeDescriptionType,
    PerceptionMessage
} from '@tonylb/mtw-interfaces/ts/messages'

import RenderTreeContent from './RenderTreeContent'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardFeature } from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardKnowledge } from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardExample } from '@tonylb/mtw-wml/ts/standardize/components/example'

type ComponentDescriptionProps<T extends FeatureDescriptionType | KnowledgeDescriptionType | (PerceptionMessage & { parsedWML?: StandardForm })> = {
    message: T;
    children?: ReactChild | ReactChildren;
    icon: ReactElement;
    bevel?: string;
    onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraActionId | EphemeraCharacterId) => void;
    toolActions?: ReactElement;
    // Bridge state properties for WML support
    parsedWML?: StandardForm;
    componentUUID?: ComponentUUID;
}

export const ComponentDescription = <T extends FeatureDescriptionType | KnowledgeDescriptionType | (PerceptionMessage & { parsedWML?: StandardForm })>({ 
    message, 
    icon, 
    bevel, 
    onClickLink, 
    toolActions,
    parsedWML,
    componentUUID
}: ComponentDescriptionProps<T>) => {
    // Bridge state: handle both legacy and WML formats
    let name: StandardRender = new StandardRender(['Unknown'])
    let description: StandardRender = new StandardRender([])
    
    if (parsedWML && componentUUID) {
        // WML format: extract from StandardForm
        const component = parsedWML.byUniversalId[componentUUID]
        if (component) {
            // Check if component is a Feature or Knowledge component (which have examples)
            if (component instanceof StandardFeature || component instanceof StandardKnowledge) {
                const firstExample = component.examples.payload[0]
                if (firstExample && firstExample.universalKey) {
                    const exampleComponent = parsedWML.byUniversalId[firstExample.universalKey as ComponentUUID]
                    if (exampleComponent && exampleComponent instanceof StandardExample) {
                        name = exampleComponent.name ? new StandardRender(exampleComponent.name) : new StandardRender(['Unknown'])
                        description = exampleComponent.description ? new StandardRender(exampleComponent.description) : new StandardRender([])
                    }
                }
            }
        }
    } else {
        // Legacy format: only handle actual legacy message types
        if (message.DisplayProtocol === 'FeatureDescription' || message.DisplayProtocol === 'KnowledgeDescription') {
            const legacyMessage = message as FeatureDescriptionType | KnowledgeDescriptionType
            name = new StandardRender(legacyMessage.Name || ['Unknown'])
            description = new StandardRender(legacyMessage.Description || [])
        }
        // For PerceptionMessage without parsedWML, keep default values (Unknown/empty)
    }
    
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
                    { name.plainString }
                </Typography>
                <Divider />
                {
                    description && description.plainString
                        ? <RenderTreeContent list={description.toJSON()} onClickLink={onClickLink} />
                        : <em>No description</em>
                }
            </Box>
        </MessageComponent>
}

export default ComponentDescription
