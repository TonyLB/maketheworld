import React, { ReactChild, ReactChildren} from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { RoomCharacter as RoomCharacterType } from '@tonylb/mtw-interfaces/ts/messages'
import { socketDispatchPromise } from '../../slices/lifeLine'

import { useActiveCharacter } from '../ActiveCharacter'

import CharacterChip from '../CharacterChip'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'

interface RoomCharacterProps {
    character: StandardCharacter;  // Only accept Standard format
    inactive?: boolean;
    children?: ReactChild | ReactChildren;
}

export const RoomCharacter = ({ character, inactive = false }: RoomCharacterProps) => {
    // Access data through StandardCharacter getters - displayName is now a StandardLiteral
    const characterName = character.displayName ? (character.displayName._payload?.plain?.toJSON?.() as string) : 'Unknown Character'
    const characterId = character.universalKey || character.key as any
    const characterImage = (character.image?.data && 'fileURL' in character.image.data) ? character.image.data.fileURL || '' : ''

    const { CharacterId: viewCharacterId } = useActiveCharacter()
    const dispatch = useDispatch()

    if (inactive) {
        //
        // Historical room headers render character chips as plain grey, inert
        // affordances. CharacterChip's variant="inactive" branch skips
        // CharacterStyleWrapper and ignores onClick.
        //
        return (
            <div data-testid="room-character">
                <CharacterChip
                    CharacterId={characterId}
                    Name={characterName}
                    fileURL={characterImage}
                    variant="inactive"
                />
            </div>
        )
    }

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

    return (
        <div data-testid="room-character">
            <CharacterChip CharacterId={characterId} onClick={clickHandler} Name={characterName} fileURL={characterImage} />
        </div>
    )
}

export default RoomCharacter
