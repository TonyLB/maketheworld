import { useDispatch, useSelector } from "react-redux"
import { getFirstChoiceDialog } from "../../slices/UI/choiceDialog"

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material'
import { blue } from '@mui/material/colors'

export const OnboardingDisplay = () => {
    const currentDialog = useSelector(getFirstChoiceDialog)
    // const dispatch = useDispatch()

    return <Dialog
        maxWidth="lg"
        open={!Boolean(currentDialog)}
    >
        <DialogTitle id="confirm-dialog-title" sx={{ bgcolor: blue[50] }}>Test Title</DialogTitle>
        <DialogContent>
            Test Dialog
        </DialogContent>
    </Dialog>

}

export default OnboardingDisplay
