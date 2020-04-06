// Foundational imports (React, Redux, etc.)
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

// MaterialUI imports
import {
    Card,
    CardHeader,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Tooltip,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction
} from '@material-ui/core'
import CreateIcon from '@material-ui/icons/Create'
import AddIcon from '@material-ui/icons/AddBox'

// Local code imports
import MyCharacterDialog from '../MyCharacterDialog/'
import { closeAllCharactersDialog } from '../../actions/UI/allCharactersDialog'
import { activateMyCharacterDialog, populateAndActivateMyCharacterDialog } from '../../actions/UI/myCharacterDialog'
import { getAllCharactersDialogUI } from '../../selectors/UI/allCharactersDialog.js'
import { getMyCharacters } from '../../selectors/myCharacters'
import useStyles from '../styles'

export const AllCharactersDialog = () => {
    const { open } = useSelector(getAllCharactersDialogUI)
    const myCharacters = useSelector(getMyCharacters) || []
    const dispatch = useDispatch()

    const classes = useStyles()
    return(
        <Dialog
            maxWidth="lg"
            open={open}
        >
            <DialogTitle id="all-character-dialog-title">Character Overview</DialogTitle>
            <DialogContent>
                <MyCharacterDialog nested />
                <Card className={classes.card}>
                    <CardHeader
                        title="My Characters"
                        className={classes.lightblue}
                        titleTypographyProps={{ variant: "overline" }}
                        action={<Tooltip title={"Add Character"}>
                                <IconButton
                                    aria-label="add character"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        dispatch(activateMyCharacterDialog({
                                            nested: true
                                        }))
                                    }}
                                >
                                    <AddIcon fontSize="inherit" />
                                </IconButton>
                            </Tooltip>}
                    />
                    <CardContent className={classes.scrollingCardContent} >
                        <List>
                            {
                                myCharacters.map(({
                                    Name
                                }) => (
                                    <ListItem key={Name}>
                                        <ListItemText>
                                            { Name }
                                        </ListItemText>
                                        <ListItemSecondaryAction>
                                            <Tooltip title={`Edit ${Name}`}>
                                                <IconButton onClick={() => {
                                                        dispatch(populateAndActivateMyCharacterDialog({ Name, nested: true }))
                                                    }
                                                } >
                                                    <CreateIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))
                            }
                        </List>
                    </CardContent>
                </Card>
            </DialogContent>
            <DialogActions>
                <Button onClick={ () => { dispatch(closeAllCharactersDialog()) } }>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default AllCharactersDialog