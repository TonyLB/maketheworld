// Foundational imports (React, Redux, etc.)
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@material-ui/core'

// Local code imports
import { closeConfirmDialog } from '../../actions/UI/confirmDialog'
import { getCurrentConfirmDialogUI } from '../../selectors/UI/confirmDialog.js'
import useStyles from '../styles'

export const ConfirmDialog = () => {
    const currentDialog = useSelector(getCurrentConfirmDialogUI)
    const dispatch = useDispatch()

    const classes = useStyles()
    return(
        <Dialog
            maxWidth="lg"
            open={Boolean(currentDialog)}
        >
            { currentDialog && currentDialog.title && <DialogTitle id="all-character-dialog-title">{ currentDialog.title }</DialogTitle> }
            <DialogContent>
                { currentDialog && currentDialog.content }
            </DialogContent>
            <DialogActions>
                <Button onClick={ () => { dispatch(closeConfirmDialog()) } }>
                    Cancel
                </Button>
                { currentDialog && currentDialog.resolveButtonTitle && 
                    <Button onClick={ () => {
                        currentDialog && currentDialog.resolve && currentDialog.resolve()
                        dispatch(closeConfirmDialog())
                    }}>
                        { currentDialog.resolveButtonTitle }
                    </Button>
                }
            </DialogActions>
        </Dialog>
    )
}

export default ConfirmDialog