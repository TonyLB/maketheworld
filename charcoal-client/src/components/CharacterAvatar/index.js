import React from 'react'
import { useSelector } from 'react-redux'
import PropTypes from "prop-types"

import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import PureCharacterAvatar from './PureCharacterAvatar'

export const CharacterAvatar = ({
    CharacterId,
    alreadyNested = false,
    viewAsSelf = false
}) => {
    const charactersInPlay = useSelector(getCharactersInPlay)
    const { Name, color = {} } = (charactersInPlay ?? {})[CharacterId] ?? {}
    return <PureCharacterAvatar
        Name={Name}
        color={viewAsSelf ? 'blue' : color.primary}
        alreadyNested={alreadyNested}
    />
}

CharacterAvatar.propTypes = {
    CharacterId: PropTypes.string,
    alreadyNested: PropTypes.bool,
    viewAsSelf: PropTypes.bool
}
export default CharacterAvatar