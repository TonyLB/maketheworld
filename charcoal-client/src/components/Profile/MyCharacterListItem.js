import React from 'react'
import PropTypes from "prop-types"

// MaterialUI imports
import {
    Tooltip,
    IconButton,
    ListItem,
    ListItemText,
    ListItemSecondaryAction
} from '@material-ui/core'
import CreateIcon from '@material-ui/icons/Create'
import AccountIcon from '@material-ui/icons/AccountBox'

import useStyles from '../styles'

export const MyCharacterListItem = ({ CharacterId = '', Name = '', onEdit = () => {}, onConnect = () => {}, ...rest }) => {
    const classes = useStyles()

    return <ListItem className={classes.characterSelectionListItem} {...rest} >
        <ListItemText>
            { Name }
        </ListItemText>
        <ListItemSecondaryAction>
            <Tooltip title={`Edit ${Name}`}>
                <IconButton onClick={onEdit} >
                    <CreateIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title={`Play ${Name}`}>
                <IconButton onClick={onConnect} >
                    <AccountIcon />
                </IconButton>
            </Tooltip>
        </ListItemSecondaryAction>
    </ListItem>
}

MyCharacterListItem.propTypes = {
    CharacterId: PropTypes.string,
    Name: PropTypes.string,
    onEdit: PropTypes.func,
    onConnect: PropTypes.func
}

export default MyCharacterListItem