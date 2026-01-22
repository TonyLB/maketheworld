import React, { ReactChild, ReactChildren } from 'react'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import {
    Box,
    Typography,
    Divider
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'

import MessageComponent from './MessageComponent'
import { CharacterAvatarDirect } from '../CharacterAvatar'
import {
    PerceptionMessage,
    isPerceptionCharacterMetaData
} from '@tonylb/mtw-interfaces/ts/messages'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

interface CharacterDescriptionProps {
    message: PerceptionMessage & { parsedWML?: StandardForm };
    children?: ReactChild | ReactChildren;
}

export const CharacterDescription = ({ message }: CharacterDescriptionProps) => {
    const theme = useTheme()
    const medium = useMediaQuery(theme.breakpoints.up('md'))
    const large = useMediaQuery(theme.breakpoints.up('lg'))
    const portraitSize = large ? 160 : medium ? 120 : 80
    
    // Ensure this is actually character metadata - this should never fail if routing is correct
    if (!isPerceptionCharacterMetaData(message.metaData)) {
        throw new Error(`CharacterDescription component received non-character metadata: ${message.metaData.componentUUID}. This indicates a bug in message routing.`)
    }
    const CharacterId = message.metaData.componentUUID
    
    let Name: string
    let fileURL: string | undefined
    
    if (message.parsedWML) {
        const component = message.parsedWML.byUniversalId[CharacterId]
        if (component instanceof StandardCharacter) {
            Name = component.name?.plainString || 'Unknown'
            // Safely access image fileURL
            const imageData = component.image?.data
            fileURL = imageData && 'fileURL' in imageData ? imageData.fileURL : undefined
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
            leftIcon={
                <CharacterAvatarDirect
                    CharacterId={CharacterId}
                    Name={Name}
                    fileURL={fileURL}
                    width={`${portraitSize}px`}
                    height={`${portraitSize}px`}
                />
            }
            leftGutter={portraitSize + 20}
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
