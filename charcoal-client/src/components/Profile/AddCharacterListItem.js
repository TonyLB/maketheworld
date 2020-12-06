import React from 'react'
import PropTypes from "prop-types"

// MaterialUI imports
import {
    ListItem,
    ListItemText
} from '@material-ui/core'
import AddIcon from '@material-ui/icons/AddCircleOutline'

import useStyles from '../styles'

export const AddCharacterListItem = ({ onEdit = () => {}, ...rest }) => {
    const classes = useStyles()

    return <ListItem className={classes.characterAddListItem} {...rest} >
        <ListItemText onClick={onEdit} primaryTypographyProps={{ align: 'center' }}>
            Add Character <AddIcon />
        </ListItemText>
    </ListItem>
}

AddCharacterListItem.propTypes = {
    onEdit: PropTypes.func
}

export default AddCharacterListItem