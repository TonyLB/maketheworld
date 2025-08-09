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
    CharacterDescription as CharacterDescriptionType,
    PerceptionMessage,
    isPerceptionCharacterMetaData
} from '@tonylb/mtw-interfaces/ts/messages'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

interface CharacterDescriptionProps {
    message: CharacterDescriptionType | (PerceptionMessage & { parsedWML?: StandardForm });
    children?: ReactChild | ReactChildren;
}

export const CharacterDescription = ({ message }: CharacterDescriptionProps) => {
    const theme = useTheme()
    const medium = useMediaQuery(theme.breakpoints.up('md'))
    const large = useMediaQuery(theme.breakpoints.up('lg'))
    const portraitSize = large ? 160 : medium ? 120 : 80
    
    // Handle both legacy CharacterDescription and new PerceptionMessage formats
    let CharacterId: EphemeraCharacterId
    let Name: string
    let fileURL: string | undefined
    
    if (message.DisplayProtocol === 'CharacterDescription') {
        // Legacy format
        const legacyMessage = message as CharacterDescriptionType
        CharacterId = legacyMessage.CharacterId
        Name = legacyMessage.Name
        fileURL = legacyMessage.fileURL
    } else if (message.DisplayProtocol === 'PerceptionMessage') {
        // New PerceptionMessage format
        const perceptionMessage = message as PerceptionMessage & { parsedWML?: StandardForm }
        
        // Ensure this is actually character metadata - this should never fail if routing is correct
        if (!isPerceptionCharacterMetaData(perceptionMessage.metaData)) {
            throw new Error(`CharacterDescription component received non-character metadata: ${perceptionMessage.metaData.componentUUID}. This indicates a bug in message routing.`)
        }
        CharacterId = perceptionMessage.metaData.componentUUID
        
        if (perceptionMessage.parsedWML) {
            const component = perceptionMessage.parsedWML.byUniversalId[CharacterId]
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
    } else {
        // Fallback
        CharacterId = 'CHARACTER#UNKNOWN' as EphemeraCharacterId
        Name = 'Unknown'
        fileURL = undefined
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
