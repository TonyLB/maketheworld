//
// CharacterChip shows a small nameplate for a character, with a tooltip summarizing their
// details.  It depends upon Redux for this information, and accepts only CharacterId
//

import React, { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { Chip, Avatar } from '@mui/material'
import { grey } from '@mui/material/colors'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { getConfiguration } from '../../slices/configuration'
import { DevEnvironment } from '../../environment'

export type CharacterChipVariant = 'default' | 'inactive'

type CharacterChipProps = {
    CharacterId: EphemeraCharacterId;
    Name?: string;
    fileURL?: string;
    onClick?: () => void;
    variant?: CharacterChipVariant;
}

export const CharacterChip: FunctionComponent<CharacterChipProps> = ({ CharacterId, Name, fileURL, onClick, variant = 'default' }) => {
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const appBaseURL = DevEnvironment ? `https://${AppBaseURL}` : ''
    const charactersInPlay = useSelector(getCharactersInPlay)
    const { DisplayName: defaultName, fileURL: fileURLCurrent } = charactersInPlay[CharacterId]
    const labelText = Name || defaultName
    const initialChar = ((labelText || '?')[0] || '?').toUpperCase()
    const resolvedFileURL = fileURL ?? fileURLCurrent
    const avatarSrc = resolvedFileURL ? `${appBaseURL}/images/${resolvedFileURL}.png` : undefined

    if (variant === 'inactive') {
        //
        // Plain grey chip: skip CharacterStyleWrapper (no per-character theme) and drop
        // onClick so historical room affordances are visually muted and inert. The variant
        // API is kept as a string union so future muted-but-character-tinted treatments
        // can swap implementation behind the same prop without API churn (D1).
        //
        return (
            <Chip
                label={labelText}
                avatar={fileURL
                    ? <Avatar
                        sx={{ borderColor: grey[500], borderWidth: '2px', borderStyle: 'solid', bgcolor: grey[400] }}
                        alt={labelText || '?'}
                        src={avatarSrc}
                    >
                        { initialChar }
                    </Avatar>
                    : undefined
                }
                sx={{
                    color: grey[800],
                    bgcolor: grey[300],
                    maxWidth: '10em',
                    textOverflow: 'ellipsis'
                }}
            />
        )
    }

    return (
        <CharacterStyleWrapper CharacterId={CharacterId} nested>
            <Chip
                label={labelText}
                onClick={onClick}
                avatar={fileURL
                    ? <Avatar sx={fileURL ? { borderColor: "primary.main", borderWidth: '2px', borderStyle: "solid" } : { bgcolor: 'primary.main' }} alt={labelText || '?'} src={resolvedFileURL && `${appBaseURL}/images/${resolvedFileURL}.png`}>
                        { initialChar }
                    </Avatar>
                    : undefined
                }
                sx={{
                    color: 'black',
                    bgcolor: 'extras.midPale',
                    maxWidth: "10em",
                    textOverflow: "ellipsis"
                }}
            />
        </CharacterStyleWrapper>
)
}

export default CharacterChip
