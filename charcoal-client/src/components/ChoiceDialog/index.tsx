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
} from '@mui/material'
import { blue } from '@mui/material/colors'

// Local code imports
import { pop, getFirstChoiceDialog } from '../../slices/UI/choiceDialog'

export const ConfirmDialog = () => {
    const currentDialog = useSelector(getFirstChoiceDialog)
    const dispatch = useDispatch()

    if (!currentDialog) {
        return <Dialog maxWidth="lg" open={false} />
    }
    const { title, message, resolve, options } = currentDialog
    return(
        <Dialog
            maxWidth="lg"
            open={Boolean(currentDialog)}
        >
            <DialogTitle id="confirm-dialog-title" sx={{ bgcolor: blue[50] }}>{ title }</DialogTitle>
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