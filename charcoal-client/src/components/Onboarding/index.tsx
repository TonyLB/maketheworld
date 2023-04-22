import React, { FunctionComponent } from "react"

// MaterialUI imports
import { blue } from '@mui/material/colors'
import { Box, Typography, useMediaQuery } from "@mui/material"

export const OnboardingDisplay: FunctionComponent<{}> = ({ children }) => {
    const portrait = useMediaQuery('(orientation: portrait)')
    //
    // TODO: Add Header message creating narrative and call-to-action
    // TODO: Create Lockout mode for Create and Play
    //
    return <React.Fragment>
        <Box sx={{ width: "80%", maxWidth: "40em", marginLeft: "auto", marginRight: "auto" }}>
            <Typography variant='body1' align='left'>
                Welcome to this Make The World instance. Familiarize yourself with the way that you can navigate around
                the application itself: Select the "Settings" tab { portrait ? "above" : "to the left" }.
            </Typography>
        </Box>
        { children }
    </React.Fragment>

}

export default OnboardingDisplay
