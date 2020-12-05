//
// MyCharacters lists the characters assigned to the active player, with controls to edit, archive, and connect
//

import React from 'react'

// MaterialUI imports
import {
    Tooltip,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction
} from '@material-ui/core'
import CreateIcon from '@material-ui/icons/Create'
import AccountIcon from '@material-ui/icons/AccountBox'

import useStyles from '../styles'

export const MyCharacters = ({ myCharacters = [], editCharacter = () => {}, connectCharacter = () => {} }) => {
    const classes = useStyles()
    return <List className={classes.characterSelectionList}>
        {
            myCharacters.map(({
                Name,
                CharacterId
            }, index) => (
                <ListItem className={classes.characterSelectionListItem} key={CharacterId || `Character-${index}`}>
                    <ListItemText>
                        { Name }
                    </ListItemText>
                    <ListItemSecondaryAction>
                        <Tooltip title={`Edit ${Name}`}>
                            <IconButton onClick={() => { editCharacter(CharacterId) }} >
                                <CreateIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={`Play ${Name}`}>
                            <IconButton onClick={() => { }} >
                                <AccountIcon />
                            </IconButton>
                        </Tooltip>
                    </ListItemSecondaryAction>
                </ListItem>
            ))
        }
    </List>

}

export default MyCharacters
