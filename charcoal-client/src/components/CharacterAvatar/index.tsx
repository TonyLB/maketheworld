import React, { FunctionComponent} from 'react'
import { useSelector } from 'react-redux'

import {
    Avatar
} from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'

interface CharacterAvatarDirectProps {
    CharacterId: string;
    Name: string;
    fileURL?: string;
    width?: string;
    height?: string;
}

export const CharacterAvatarDirect: FunctionComponent<CharacterAvatarDirectProps> = ({ CharacterId, Name, fileURL, width, height }) => {
    return <CharacterStyleWrapper key={CharacterId} CharacterId={CharacterId}>
        <Avatar sx={fileURL ? { borderColor: "primary.main", borderWidth: '2px', borderStyle: "solid", width, height } : { bgcolor: 'primary.main', width, height }} alt={Name} src={fileURL}>
            { Name[0].toUpperCase() }
        </Avatar>
    </CharacterStyleWrapper>
}

interface CharacterAvatarProps {
    CharacterId: string;
    width?: string;
    height?: string;
}

export const CharacterAvatar: FunctionComponent<CharacterAvatarProps> = ({ CharacterId, width, height }) => {
    const charactersInPlay = useSelector(getCharactersInPlay)

    const { Name, fileURL } = charactersInPlay[CharacterId]
    return <CharacterAvatarDirect CharacterId={CharacterId} Name={Name} fileURL={fileURL} width={width} height={height} />
}

export default CharacterAvatar
