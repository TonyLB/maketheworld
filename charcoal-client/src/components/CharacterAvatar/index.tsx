import React, { FunctionComponent} from 'react'
import { useSelector } from 'react-redux'

import {
    Avatar
} from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { getConfiguration } from '../../slices/configuration'

interface CharacterAvatarDirectProps {
    CharacterId: EphemeraCharacterId;
    Name: string;
    fileURL?: string;
    width?: string;
    height?: string;
}

export const CharacterAvatarDirect: FunctionComponent<CharacterAvatarDirectProps> = ({ CharacterId, Name, fileURL, width, height }) => {
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const appBaseURL = process.env.NODE_ENV === 'development' ? `https://${AppBaseURL}` : ''
    return <CharacterStyleWrapper key={CharacterId} CharacterId={CharacterId}>
        <Avatar sx={fileURL ? { borderColor: "primary.main", borderWidth: '2px', borderStyle: "solid", width, height } : { bgcolor: 'primary.main', width, height }} alt={Name} src={fileURL && `${appBaseURL}/images/${fileURL}.png`}>
            { Name[0].toUpperCase() }
        </Avatar>
    </CharacterStyleWrapper>
}

interface CharacterAvatarProps {
    CharacterId: EphemeraCharacterId;
    width?: string;
    height?: string;
}

export const CharacterAvatar: FunctionComponent<CharacterAvatarProps> = ({ CharacterId, width, height }) => {
    const charactersInPlay = useSelector(getCharactersInPlay)

    const { Name, fileURL } = charactersInPlay[CharacterId]
    return <CharacterAvatarDirect CharacterId={CharacterId} Name={Name} fileURL={fileURL} width={width} height={height} />
}

export default CharacterAvatar
