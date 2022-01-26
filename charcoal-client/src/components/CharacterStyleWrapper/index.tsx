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

declare module '@mui/material/styles' {
    interface PaletteOptions {
        extras?: {
            midPale?: string;
            pale?: string;
            paleTransparent?: string;
            paleGradient?: string;
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
                paleGradient: `linear-gradient(${color[50]} 30%, ${color[100]})`
            }
        },
    })
})).reduce((prev, item) => ({ ...prev, ...item }), {})

export type LegalCharacterColor = 'blue' | 'pink' | 'purple' | 'green' | 'grey'
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
    CharacterId: string;
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

    return <CharacterColorWrapper color={(activeId === CharacterId) ? 'blue' : color.name as LegalCharacterColor || 'grey'} >
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
