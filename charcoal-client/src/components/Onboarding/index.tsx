import React from "react"

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material'
import { blue } from '@mui/material/colors'
import { FunctionComponent } from "react"

export const OnboardingDisplay: FunctionComponent<{}> = ({ children }) => {

    //
    // TODO: Create Settings navigation tab
    // TODO: Move "Logout" from Home page to Settings tab
    // TODO: Move Play above Create
    // TODO: Create Lockout mode for Create and Play
    // TODO: Add Header message creating narrative and call-to-action
    //
    return <React.Fragment>
        { children }
    </React.Fragment>

}

export default OnboardingDisplay
