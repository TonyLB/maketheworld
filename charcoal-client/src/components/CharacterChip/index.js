//
// CharacterChip shows a small nameplate for a character, with a tooltip summarizing their
// details.  It depends upon Redux for this information, and accepts only CharacterId
//

import React from 'react'
import { useSelector } from 'react-redux'
import PropTypes from "prop-types"

import PureCharacterChip from './PureCharacterChip'
import { getCharactersInPlay } from '../../slices/ephemera'

export const CharacterChip = ({
    CharacterId
}) => {
    const charactersInPlay = useSelector(getCharactersInPlay)
    const {
        Name = '??????',
        Pronouns = '',
        FirstImpression = '',
        OneCoolThing = '',
        Outfit = '',
        color = { primary: "grey" }
    } = (charactersInPlay && charactersInPlay[CharacterId])
        ?? {}
    return (
        <PureCharacterChip
            Name={Name}
            Pronouns={Pronouns}
            FirstImpression={FirstImpression}
            OneCoolThing={OneCoolThing}
            Outfit={Outfit}
            color={color}
        />
    )
}

CharacterChip.propTypes = {
    CharacterId: PropTypes.string
}

export default CharacterChip
