import React, { ReactElement, ReactNode } from 'react'

import {
    Box,
    Typography,
    Divider
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'

import MessageComponent from './MessageComponent'
import {
    PerceptionMessageMetaData
} from '@tonylb/mtw-interfaces/ts/messages'

import RenderTreeContent from './RenderTreeContent'
import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRender, PlainClass } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import { StandardFeature } from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardKnowledge } from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { SituationProseFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { DEFAULT_SITUATION_ID } from '../../slices/personalAssets'

type ComponentDescriptionProps = {
    parsedWML: StandardForm;
    metaData: PerceptionMessageMetaData;
    children?: ReactNode;
    icon: ReactElement;
    bevel?: string;
    onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraCharacterId) => void;
    toolActions?: ReactElement;
}

function resolveFeatureKnowledgeProse(
    component: StandardFeature | StandardKnowledge
): SituationProseFacetPayload | undefined {
    if (component.render) {
        const fromRender = new SituationProseFacetPayload(component.render)
        if (!SituationProseFacetPayload.isEmpty(fromRender)) {
            return fromRender
        }
    }
    const defaultFacet = component.situations.items.find(
        (facet) => facet.reference?.universalKey === DEFAULT_SITUATION_ID
    )
    if (defaultFacet) {
        return defaultFacet.payload as SituationProseFacetPayload
    }
    return undefined
}

export const ComponentDescription = ({
    parsedWML,
    metaData,
    icon,
    bevel,
    onClickLink,
    toolActions
}: ComponentDescriptionProps) => {
    let name: StandardLiteral = new StandardLiteral('Unknown', { tag: 'DisplayName' })
    let description: StandardRender = new StandardRender([])

    const componentUUID = metaData.componentUUID
    const component = parsedWML.byUniversalId[componentUUID]
    if (component instanceof StandardFeature || component instanceof StandardKnowledge) {
        const prosePayload = resolveFeatureKnowledgeProse(component)
        if (prosePayload) {
            name = prosePayload._displayName || new StandardLiteral('Unknown', { tag: 'DisplayName' })
            description = prosePayload._description || new StandardRender([])
        }
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
                    { name._payload?.plain?.toJSON() ?? 'Unknown' }
                </Typography>
                <Divider />
                {
                    (() => {
                        const plain = description?.plain ?? []
                        if (description && description._payload && !(description._payload instanceof PlainClass)) {
                            console.error('Expected PlainClass but got', description._payload.constructor.name, description)
                        }
                        return plain.length > 0
                            ? <RenderTreeContent list={plain} onClickLink={onClickLink} />
                            : <em>No description</em>
                    })()
                }
            </Box>
        </MessageComponent>
}

export default ComponentDescription
