import React, { ReactChild, ReactChildren} from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { RoomCharacter as RoomCharacterType } from '@tonylb/mtw-interfaces/ts/messages'
import { socketDispatchPromise } from '../../slices/lifeLine'

import { useActiveCharacter } from '../ActiveCharacter'

import CharacterChip from '../CharacterChip'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

interface RoomCharacterProps {
    character: StandardCharacter;  // Only accept Standard format
    children?: ReactChild | ReactChildren;
}

export const RoomCharacter = ({ character }: RoomCharacterProps) => {
    // Access data through StandardCharacter getters and convert to StandardRender
    const characterName = character.name ? new StandardRender(character.name).plainString : 'Unknown Character'
    const characterId = character.universalKey as any
    const characterImage = character.image ? new StandardRender(character.image).plainString : undefined

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