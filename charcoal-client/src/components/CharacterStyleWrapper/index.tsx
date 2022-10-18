import { ReactChild, ReactChildren, FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import {
    blue,
    pink,
    purple,
    green,
    grey
} from "@mui/material/colors"

import { getActiveCharacterList } from '../../slices/ephemera'
import { getPlayer } from '../../slices/player'
import { useActiveCharacter } from '../ActiveCharacter'
import { EphemeraCharacterId, LegalCharacterColor } from '@tonylb/mtw-interfaces/dist/baseClasses'

declare module '@mui/material/styles' {
    interface PaletteOptions {
        extras?: {
            midPale?: string;
            pale?: string;
            paleTransparent?: string;
            paleGradient?: string;
            stripedGradient?: string;
        }
    }
}

//
// TODO: Typescript-constrain characterPalettes
//
const characterThemes = (Object.entries({ blue, pink, purple, green, grey })).map(([colorName, color]) => ({
    [colorName]: createTheme({
        palette: {
            primary: color,
            extras: {
                midPale: color[100],
                pale: color[50],
                paleTransparent: `${color[50]} transparent`,
                paleGradient: `linear-gradient(${color[50]} 30%, ${color[100]})`,
                stripedGradient: `
                    repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 10px,
                        ${color[50]}80 10px,
                        ${color[50]}80 20px
                    ),
                    linear-gradient(white 70%, ${color[50]})
                `
            }
        },
    })
})).reduce((prev, item) => ({ ...prev, ...item }), {})

type CharacterColorWrapper = {
    color: LegalCharacterColor;
    children?: ReactChild | ReactChildren;
}

export const CharacterColorWrapper: FunctionComponent<CharacterColorWrapper> = ({ color, children }) => (
    <ThemeProvider theme={characterThemes[color] || characterThemes.grey} >
        { children }
    </ThemeProvider>
)

type CharacterStyleWrapperProps = {
    CharacterId: EphemeraCharacterId;
    nested?: boolean;
    children?: ReactChild | ReactChildren;
}

const OpenCharacterStyleWrapper: FunctionComponent<Omit<CharacterStyleWrapperProps, 'nested'>> = ({ CharacterId, children }) => {
    const whoIsActive = useSelector(getActiveCharacterList)
    const { Characters } = useSelector(getPlayer)
    const myCharacterIds = Characters.map(({ CharacterId }) => (CharacterId))

    const { color } = whoIsActive.find((character) => (character.CharacterId === CharacterId)) || { color: { name: 'grey' } }
    return <CharacterColorWrapper color={myCharacterIds.includes(CharacterId) ? 'blue' : color.name as LegalCharacterColor || 'grey'} >
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
