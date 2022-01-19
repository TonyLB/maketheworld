import React, { ReactChild, ReactChildren} from 'react'
import { useSelector } from 'react-redux'

import { RoomCharacter as RoomCharacterType } from '../../slices/messages/baseClasses'

import { getCharactersInPlay } from '../../slices/ephemera'
import { useActiveCharacter } from '../ActiveCharacter'
//
// TODO: Refactor character chip to handle data as it is passed in v2Alpha
//
import PureCharacterChip from '../CharacterChip/PureCharacterChip'

interface RoomCharacterProps {
    character: RoomCharacterType;
    children?: ReactChild | ReactChildren;
}

export const RoomCharacter = ({
    character: {
        CharacterId,
        Name    
    }
}: RoomCharacterProps) => {
    const { CharacterId: viewAsCharacterId } = useActiveCharacter()
    const charactersInPlay = useSelector(getCharactersInPlay)
    const { color = { primary: 'blue' } } = ((CharacterId !== viewAsCharacterId) && charactersInPlay[CharacterId]) || { color: {} }
    return <PureCharacterChip
            Name={Name}
            color={color}
        />
}

export default RoomCharacter