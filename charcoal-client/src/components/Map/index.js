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
import { getMaps } from '../../selectors/maps'
import MapCanvas from './MapCanvas'
import useStyles from '../styles'

export const MapDialog = () => {
    const open = useSelector(getMapDialogUI)
    const dispatch = useDispatch()
    const classes = useStyles()
    const map = useSelector(getMaps).Test

    const closeHandler = () => { dispatch(closeMapDialog()) }
    return(
        <Dialog
            maxWidth="lg"
            open={open}
            onClose={closeHandler}
        >
            <DialogTitle id="help-dialog-title" className={classes.lightblue}>Map</DialogTitle>
            <DialogContent>
                <MapCanvas map={map} />
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