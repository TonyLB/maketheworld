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
    Select,
    MenuItem,
    Grid,
    FormGroup,
    FormControlLabel,
    Switch
} from '@material-ui/core'

// Local code imports
import { closeClientSettingsDialog } from '../../actions/UI/clientSettingsDialog'
import { getClientSettingsDialogUI } from '../../selectors/UI/clientSettingsDialog.js'
import { getClientSettings } from '../../selectors/clientSettings'
import { putClientSettings } from '../../actions/clientSettings'
import useStyles from '../styles'

export const AdminDialog = () => {
    const { open } = useSelector(getClientSettingsDialogUI)
    const { TextEntryLines, ShowNeighborhoodHeaders = true } = useSelector(getClientSettings)
    const dispatch = useDispatch()

    const classes = useStyles()
    return(
        <React.Fragment>
            <Dialog
                maxWidth="lg"
                open={open}
            >
                <DialogTitle id="client-settings-dialog-title">Client Settings</DialogTitle>
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
                                            <Select
                                                labelId="textEntrySize"
                                                id="textEntrySize"
                                                value={TextEntryLines || 1}
                                                onChange={(event) => {
                                                    dispatch(putClientSettings({ TextEntryLines: event.target.value }))
                                                }}
                                            >
                                                <MenuItem value={1}>Poetry (one line)</MenuItem>
                                                <MenuItem value={2}>Prose (two lines)</MenuItem>
                                                <MenuItem value={4}>Epic (four lines)</MenuItem>
                                                <MenuItem value={8}>Indulgence (eight lines)</MenuItem>
                                            </Select>
                                        </div>
                                        <div>
                                            <FormGroup row>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={ShowNeighborhoodHeaders}
                                                            onChange={ (event) => { dispatch(putClientSettings({ ShowNeighborhoodHeaders: event.target.checked })) } }
                                                            name="showNeighborhoodHeaders"
                                                            color="primary"
                                                        />
                                                    }
                                                    label="Show Neighborhoods on movement"
                                                />
                                            </FormGroup>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={ () => { dispatch(closeClientSettingsDialog) } }>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}

export default AdminDialog