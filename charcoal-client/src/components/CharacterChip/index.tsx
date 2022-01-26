//
// CharacterChip shows a small nameplate for a character, with a tooltip summarizing their
// details.  It depends upon Redux for this information, and accepts only CharacterId
//

import React, { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { Chip } from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'

type CharacterChipProps = {
    CharacterId: string;
    Name?: string;
}

export const CharacterChip: FunctionComponent<CharacterChipProps> = ({ CharacterId, Name }) => {
    const charactersInPlay = useSelector(getCharactersInPlay)
    const { Name: defaultName } = charactersInPlay[CharacterId]
    return (
        <CharacterStyleWrapper CharacterId={CharacterId} nested>
            <Chip
                label={Name || defaultName}
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
