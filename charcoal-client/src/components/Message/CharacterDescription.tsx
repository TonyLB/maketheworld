import React, { ReactChild, ReactChildren } from 'react'

import {
    Box,
    Typography,
    Divider
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'

import MessageComponent from './MessageComponent'
import {
    PerceptionMessage,
    isPerceptionCharacterMetaData
} from '@tonylb/mtw-interfaces/ts/messages'
import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRender, PlainClass } from '@tonylb/mtw-wml/ts/standardize/render'
import { SituationProseFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { DEFAULT_SITUATION_ID } from '../../slices/personalAssets'
import RenderTreeContent from './RenderTreeContent'

/*
 * Character portrait (CharacterAvatarDirect) was removed: we are not using those icons in a
 * meaningful way yet. A small leftGutter remains for whitespace until we restore leftIcon and
 * larger gutter when we have better character imagery and a clear product use for it.
 */

interface CharacterDescriptionProps {
    message: PerceptionMessage & { parsedWML?: StandardForm };
    children?: ReactChild | ReactChildren;
    onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraCharacterId) => void;
}

/** Same prose-resolution rule as ComponentDescription's resolveFeatureKnowledgeProse: prefer the ephemera Render, fall back to the SITUATION#DEFAULT facet. */
function resolveCharacterProse(component: StandardCharacter): SituationProseFacetPayload | undefined {
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

export const CharacterDescription = ({ message, onClickLink }: CharacterDescriptionProps) => {
    // Ensure this is actually character metadata - this should never fail if routing is correct
    if (!isPerceptionCharacterMetaData(message.metaData)) {
        throw new Error(`CharacterDescription component received non-character metadata: ${message.metaData.componentUUID}. This indicates a bug in message routing.`)
    }
    const CharacterId = message.metaData.componentUUID

    let name: StandardLiteral = new StandardLiteral('Unknown', { tag: 'DisplayName' })
    let description: StandardRender = new StandardRender([])

    if (message.parsedWML) {
        const component = message.parsedWML.byUniversalId[CharacterId]
        if (component instanceof StandardCharacter) {
            const prosePayload = resolveCharacterProse(component)
            if (prosePayload) {
                name = prosePayload._displayName || new StandardLiteral('Unknown', { tag: 'DisplayName' })
                description = prosePayload._description || new StandardRender([])
            }
        }
    }

    return <MessageComponent
            sx={{
                paddingTop: "10px",
                paddingBottom: "10px",
                marginRight: "75px",
                marginLeft: "75px",
                background: `linear-gradient(${grey[100]}, ${grey[300]})`,
                borderRadius: '20px',
                color: (theme) => (theme.palette.getContrastText(blue[200]))
            }}
            leftGutter={20}
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

export default CharacterDescription
