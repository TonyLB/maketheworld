import React, { ReactChild, ReactChildren} from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { RoomCharacter as RoomCharacterType } from '@tonylb/mtw-interfaces/ts/messages'
import { socketDispatchPromise } from '../../slices/lifeLine'

import { useActiveCharacter } from '../ActiveCharacter'

import CharacterChip from '../CharacterChip'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'

interface RoomCharacterProps {
    character: StandardCharacter;  // Only accept Standard format
    children?: ReactChild | ReactChildren;
}

export const RoomCharacter = ({ character }: RoomCharacterProps) => {
    const characterData = character._payload.plain.toJSON()
    const characterName = typeof characterData.name === 'string' ? characterData.name : 'Unknown Character'
    const characterId = character.universalKey as any
    const characterImage = characterData.image?.fileURL

    const { CharacterId: viewCharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    //
    // TODO: Create locking mechanism, and embed something akin to "clickable" into
    // the data structure for the Exit
    //
    const clickable = true
    const clickHandler = clickable ? () => {
        dispatch(socketDispatchPromise({
            message: 'link',
            CharacterId: viewCharacterId,
            to: characterId
        }))
    } : () => {}

    return <CharacterChip CharacterId={characterId} onClick={clickHandler} Name={characterName} fileURL={characterImage} />
}

export default RoomCharacter