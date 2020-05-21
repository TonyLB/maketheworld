// Foundational imports (React, Redux, etc.)
import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from '@material-ui/core'

import { getMapDialogUI } from '../../selectors/UI/mapDialog'
import { closeMapDialog } from '../../actions/UI/mapDialog'
import useStyles from '../styles'

import MapList from './MapList'

export const MapDialog = () => {
    const open = useSelector(getMapDialogUI)
    const dispatch = useDispatch()
    const classes = useStyles()

    const closeHandler = () => { dispatch(closeMapDialog()) }
    return(
        <Dialog
            maxWidth="lg"
            open={open}
            onClose={closeHandler}
        >
            <DialogTitle id="help-dialog-title" className={classes.lightblue}>Choose a Map to Edit</DialogTitle>
            <DialogContent>
                <MapList />
            </DialogContent>
            <DialogActions>
                <Button onClick={closeHandler}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default MapDialog