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

declare module '@mui/material/styles' {
    interface PaletteOptions {
        extras?: {
            pale?: string;
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
                pale: color[50]
            }
        },
    })
})).reduce((prev, item) => ({ ...prev, ...item }), {})

type CharacterStyleWrapperProps = {
    CharacterId: string;
    children?: ReactChild | ReactChildren;
}

export const CharacterStyleWrapper: FunctionComponent<CharacterStyleWrapperProps> = ({ CharacterId, children }) => {
    const whoIsActive = useSelector(getActiveCharacterList)
    const { Characters } = useSelector(getPlayer)
    const myCharacterIds = Characters.map(({ CharacterId }) => (CharacterId))

    const { color } = whoIsActive.find((character) => (character.CharacterId === CharacterId)) || { color: { name: 'grey' } }
    return <ThemeProvider theme={characterThemes[myCharacterIds.includes(CharacterId) ? 'blue' : color.name] || characterThemes.grey} >
        { children }
    </ThemeProvider>
}

export default CharacterStyleWrapper
