//
// CharacterChip shows a small nameplate for a character, with a tooltip summarizing their
// details.  It depends upon Redux for this information, and accepts only CharacterId
//

import React, { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { Chip, Avatar } from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

type CharacterChipProps = {
    CharacterId: EphemeraCharacterId;
    Name?: string;
    onClick: () => void;
}

export const CharacterChip: FunctionComponent<CharacterChipProps> = ({ CharacterId, Name, onClick }) => {
    const charactersInPlay = useSelector(getCharactersInPlay)
    const { Name: defaultName, fileURL } = charactersInPlay[CharacterId]
    return (
        <CharacterStyleWrapper CharacterId={CharacterId} nested>
            <Chip
                label={Name || defaultName}
                onClick={onClick}
                avatar={fileURL
                    ? <Avatar sx={fileURL ? { borderColor: "primary.main", borderWidth: '2px', borderStyle: "solid" } : { bgcolor: 'primary.main' }} alt={Name} src={fileURL}>
                        { (Name || '')[0].toUpperCase() }
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
