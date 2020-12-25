import React from 'react'
import PropTypes from "prop-types"

import {
    Avatar,
    Tooltip
} from '@material-ui/core'

import useStyles from '../styles'

export const PureCharacterAvatar = ({
    color,
    Name,
    alreadyNested = false
}) => {
    const viewColor = color ? `${color.charAt(0).toUpperCase()}${color.slice(1)}` : 'Grey'
    const classes = useStyles()
    const avatarComponent = <Tooltip title={Name ?? '?'}>
        <Avatar alt={Name ?? '?'} className={`${classes.characterAvatar} avatarColor`}>
            { (Name ?? '?')[0].toUpperCase() }
        </Avatar>
    </Tooltip>
    return alreadyNested ? avatarComponent : <div className={ viewColor && classes[`player${viewColor}`] }>{avatarComponent}</div>
}

PureCharacterAvatar.propTypes = {
    color: PropTypes.oneOf(['blue', 'pink', 'green', 'purple']),
    Name: PropTypes.string,
    alreadyNested: PropTypes.bool
}
export default PureCharacterAvatar