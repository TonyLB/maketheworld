import React, { ReactChild, ReactChildren} from 'react'
import { useSelector } from 'react-redux'

import { RoomCharacter as RoomCharacterType } from '../../slices/messages/baseClasses'

import { getCharactersInPlay } from '../../slices/ephemera'
import { useActiveCharacter } from '../ActiveCharacter'
//
// TODO: Refactor character chip to handle data as it is passed in v2Alpha
//
import CharacterChip from '../CharacterChip'

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
    return <CharacterChip CharacterId={CharacterId} Name={Name} />
}

export default RoomCharacter