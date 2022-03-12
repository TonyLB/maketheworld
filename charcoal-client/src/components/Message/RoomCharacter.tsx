import React, { ReactChild, ReactChildren} from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { RoomCharacter as RoomCharacterType } from '../../slices/messages/baseClasses'
import { socketDispatchPromise } from '../../slices/lifeLine'

import { useActiveCharacter } from '../ActiveCharacter'

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
    const { CharacterId: viewCharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    //
    // TODO: Create locking mechanism, and embed something akin to "clickable" into
    // the data structure for the Exit
    //
    const clickable = true
    const clickHandler = clickable ? () => {
        dispatch(socketDispatchPromise('link')({
            targetTag: 'Character',
            viewCharacterId,
            CharacterId
        }))
    } : () => {}

    return <CharacterChip CharacterId={CharacterId} onClick={clickHandler} Name={Name} />
}

export default RoomCharacter