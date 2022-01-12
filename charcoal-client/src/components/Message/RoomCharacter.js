import React from 'react'
import { useSelector } from 'react-redux'

import { getCharactersInPlay } from '../../slices/ephemera'
import PureCharacterChip from '../CharacterChip/PureCharacterChip'

export const RoomCharacter = ({
    CharacterId,
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    viewAsCharacterId
}) => {
    const charactersInPlay = useSelector(getCharactersInPlay)
    const { color = { primary: 'blue' } } = (CharacterId !== viewAsCharacterId) && charactersInPlay[CharacterId]
    return <PureCharacterChip
            Name={Name}
            Pronouns={Pronouns}
            FirstImpression={FirstImpression}
            OneCoolThing={OneCoolThing}
            Outfit={Outfit}
            color={color}
        />
}

export default RoomCharacter