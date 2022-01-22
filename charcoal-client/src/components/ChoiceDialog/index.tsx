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
import { pop, getFirstChoiceDialog } from '../../slices/UI/choiceDialog'
import useStyles from '../styles'

export const ConfirmDialog = () => {
    const currentDialog = useSelector(getFirstChoiceDialog)
    const dispatch = useDispatch()

    const classes = useStyles()
    if (!currentDialog) {
        return <Dialog maxWidth="lg" open={false} />
    }
    const { title, message, resolve, options } = currentDialog
    return(
        <Dialog
            maxWidth="lg"
            open={Boolean(currentDialog)}
        >
            <DialogTitle id="confirm-dialog-title" className={(classes as any).lightblue }>{ title }</DialogTitle>
            <DialogContent>
                { message }
            </DialogContent>
            <DialogActions>
                { options.map(({ label, returnValue }) => (
                    <Button
                        key={label}
                        onClick={ () => {
                            resolve(returnValue)
                            dispatch(pop())
                        }}
                    >
                        { label }
                    </Button>
                ))}
            </DialogActions>
        </Dialog>
    )
}

export default ConfirmDialog