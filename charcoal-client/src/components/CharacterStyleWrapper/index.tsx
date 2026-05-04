import React, { ReactNode, FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { ThemeProvider } from '@mui/material'
import {
    blue,
    pink,
    purple,
    green,
    grey
} from "@mui/material/colors"

import { getActiveCharacterList } from '../../slices/ephemera'
import { getMySettings, getPlayer } from '../../slices/player'
import { useActiveCharacter } from '../ActiveCharacter'
import { EphemeraCharacterId, LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses'

// Import theme extensions as side-effect to ensure module augmentation is applied
import '../../theme/extensions'
import { createMakeTheWorldThemeFromColor } from '../../theme/createMakeTheWorldTheme'

//
// TODO: Typescript-constrain characterPalettes
//
// Create character themes using the centralized factory
// This ensures consistency with the overall visual language
const characterThemes = (Object.entries({ blue, pink, purple, green, grey })).map(([colorName, color]) => ({
    [colorName]: createMakeTheWorldThemeFromColor(color)
})).reduce((prev, item) => ({ ...prev, ...item }), {})

type CharacterColorWrapper = {
    color: LegalCharacterColor;
    children?: ReactNode;
}

export const CharacterColorWrapper: FunctionComponent<CharacterColorWrapper> = ({ color, children }) => (
    <ThemeProvider theme={characterThemes[color] || characterThemes.grey} >
        { children }
    </ThemeProvider>
)

type CharacterStyleWrapperProps = {
    CharacterId: EphemeraCharacterId;
    nested?: boolean;
    children?: ReactNode;
}

const OpenCharacterStyleWrapper: FunctionComponent<Omit<CharacterStyleWrapperProps, 'nested'>> = ({ CharacterId, children }) => {
    const whoIsActive = useSelector(getActiveCharacterList)
    const { Characters } = useSelector(getPlayer)
    const { guestId } = useSelector(getMySettings)
    const myCharacterIds = Characters.map(({ CharacterId }) => (CharacterId))

    const { color } = whoIsActive.find((character) => (character.CharacterId === CharacterId)) || { color: { name: 'grey' } }
    return <CharacterColorWrapper color={(CharacterId === `CHARACTER#${guestId}` || myCharacterIds.includes(CharacterId)) ? 'blue' : color.name as LegalCharacterColor || 'grey'} >
        { children }
    </CharacterColorWrapper>
}

const NestedCharacterStyleWrapper: FunctionComponent<Omit<CharacterStyleWrapperProps, 'nested'>> = ({ CharacterId, children }) => {
    const { CharacterId: activeId } = useActiveCharacter()
    const whoIsActive = useSelector(getActiveCharacterList)
    const { color } = whoIsActive.find((character) => (character.CharacterId === CharacterId)) || { color: { name: 'grey' } }

    return <CharacterColorWrapper color={(activeId === CharacterId) ? 'blue' : color.name || 'grey'} >
        { children }
    </CharacterColorWrapper>
}

export const CharacterStyleWrapper: FunctionComponent<CharacterStyleWrapperProps> = ({ nested=false, ...rest }) => {
    if (nested) {
        return <NestedCharacterStyleWrapper {...rest} />
    }
    else {
        return <OpenCharacterStyleWrapper {...rest} />
    }
}

export default CharacterStyleWrapper
