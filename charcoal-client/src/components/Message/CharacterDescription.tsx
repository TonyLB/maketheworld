import React, { ReactChild, ReactChildren } from 'react'

import {
    Box,
    Typography
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'

import MessageComponent from './MessageComponent'
import {
    PerceptionMessage,
    isPerceptionCharacterMetaData
} from '@tonylb/mtw-interfaces/ts/messages'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

/*
 * Character portrait (CharacterAvatarDirect) was removed: we are not using those icons in a
 * meaningful way yet. A small leftGutter remains for whitespace until we restore leftIcon and
 * larger gutter when we have better character imagery and a clear product use for it.
 */

interface CharacterDescriptionProps {
    message: PerceptionMessage & { parsedWML?: StandardForm };
    children?: ReactChild | ReactChildren;
}

export const CharacterDescription = ({ message }: CharacterDescriptionProps) => {
    // Ensure this is actually character metadata - this should never fail if routing is correct
    if (!isPerceptionCharacterMetaData(message.metaData)) {
        throw new Error(`CharacterDescription component received non-character metadata: ${message.metaData.componentUUID}. This indicates a bug in message routing.`)
    }
    const CharacterId = message.metaData.componentUUID

    let Name: string

    if (message.parsedWML) {
        const component = message.parsedWML.byUniversalId[CharacterId]
        if (component instanceof StandardCharacter) {
            Name = component.displayName?._payload?.plain?.toJSON() || 'Unknown'
        } else {
            Name = 'Unknown'
        }
    } else {
        Name = 'Unknown'
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
                    { Name }
                </Typography>
            </Box>
        </MessageComponent>
}

export default CharacterDescription
