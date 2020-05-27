// Foundational imports (React, Redux, etc.)
import React, { useState } from 'react'
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
    TextField,
    Grid
} from '@material-ui/core'

// Local code imports
import { closeAdminDialog } from '../../actions/UI/adminDialog'
import { putSettingsAndCloseAdminDialog } from '../../actions/settings'
import { getAdminDialogUI } from '../../selectors/UI/adminDialog.js'
import useStyles from '../styles'

export const AdminDialog = () => {
    const { open, ChatPrompt: defaultChatPrompt } = useSelector(getAdminDialogUI)
    const [{ ChatPrompt }, setValues] = useState({ ChatPrompt: defaultChatPrompt })
    const dispatch = useDispatch()

    const saveHandler = () => {
        dispatch(putSettingsAndCloseAdminDialog({ ChatPrompt }))
    }

    const classes = useStyles()
    return(
        <React.Fragment>
            <Dialog
                maxWidth="lg"
                open={open}
                onEnter={() => { setValues({ ChatPrompt: defaultChatPrompt }) }}
            >
                <DialogTitle id="admin-dialog-title">Admin Settings</DialogTitle>
                <DialogContent>
                    <Grid container>
                        <Grid item>
                            <Card className={classes.card} >
                                <CardHeader
                                    title="User Interface"
                                    className={classes.lightblue}
                                    titleTypographyProps={{ variant: "overline" }}
                                />
                                <CardContent>
                                    <form className={classes.root} noValidate autoComplete="off">
                                        <div>
                                            <TextField
                                                required
                                                id="name"
                                                label="Chat Prompt"
                                                value={ChatPrompt || ''}
                                                onChange={(event) => { setValues({ ChatPrompt: event.target.value })}}
                                            />
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={ () => { dispatch(closeAdminDialog()) } }>
                        Cancel
                    </Button>
                    <Button onClick={saveHandler}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}

export default AdminDialog