import React, { FunctionComponent, useMemo} from 'react'
import { useSelector } from 'react-redux'

import {
    Avatar
} from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { getConfiguration } from '../../slices/configuration'
import { DevEnvironment } from '../../environment'

interface CharacterAvatarDirectProps {
    CharacterId: EphemeraCharacterId;
    Name?: string;
    fileURL?: string;
    width?: string;
    height?: string;
}

export const CharacterAvatarDirect: FunctionComponent<CharacterAvatarDirectProps> = ({ CharacterId, Name, fileURL, width, height }) => {
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const appBaseURL = DevEnvironment ? `https://${AppBaseURL}` : ''
    const dressedFileURL = useMemo(() => {
        if (fileURL?.match(/https?:\/\//)) {
            return fileURL
        }
        else {
            return fileURL && `${appBaseURL}/images/${fileURL}.png`
        }
    }, [appBaseURL, fileURL])
    const initial = (Name?.trim()?.[0] ?? '?').toUpperCase()
    return <CharacterStyleWrapper key={CharacterId} CharacterId={CharacterId}>
        <Avatar sx={fileURL ? { borderColor: "primary.main", borderWidth: '2px', borderStyle: "solid", width, height } : { bgcolor: 'primary.main', width, height }} alt={Name?.trim() || '?'} src={dressedFileURL}>
            { initial }
        </Avatar>
    </CharacterStyleWrapper>
}

interface CharacterAvatarProps {
    CharacterId: EphemeraCharacterId;
    fileURL?: string;
    width?: string;
    height?: string;
}

export const CharacterAvatar: FunctionComponent<CharacterAvatarProps> = ({ CharacterId, fileURL, width, height }) => {
    const charactersInPlay = useSelector(getCharactersInPlay)

    const { DisplayName = '?', fileURL: fileURLCurrent } = charactersInPlay[CharacterId]
    return <CharacterAvatarDirect CharacterId={CharacterId} Name={DisplayName} fileURL={fileURL ?? fileURLCurrent} width={width} height={height} />
}

export default CharacterAvatar
