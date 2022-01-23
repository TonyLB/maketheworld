import { ReactChild, ReactChildren, FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'

import { characterThemes } from '../styles'
import { getActiveCharacterList } from '../../slices/ephemera'
import { getPlayer } from '../../slices/player'

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
