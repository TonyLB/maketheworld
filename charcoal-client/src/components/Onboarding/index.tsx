import React, { FunctionComponent } from "react"

// MaterialUI imports
import { blue } from '@mui/material/colors'
import {
    Box,
    Typography,
    Stepper,
    Step,
    StepLabel,
    useMediaQuery,
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText
} from "@mui/material"
import CheckIcon from '@mui/icons-material/Check'

type DenseOnboardingProgressListItemProperties = {
    text: string;
    index: number;
    completed: boolean;
}

const DenseOnboardingProgressListItem: FunctionComponent<DenseOnboardingProgressListItemProperties> = ({ text, index, completed }) => {
    return <ListItem>
        <ListItemAvatar sx={{ minWidth: "2em" }}><Avatar sx={{ width: "1em", height: "1em", bgcolor: blue[600], color: 'black' }}>{completed ? <CheckIcon fontSize="small" /> : <Typography variant="body2">{index + 1}</Typography>}</Avatar></ListItemAvatar>
        <ListItemText>{text}</ListItemText>
    </ListItem>
}

type DenseOnboardingProgressListProperties = {

}

const DenseOnboardingProgressList: FunctionComponent<DenseOnboardingProgressListProperties> = () => {
    const portrait = useMediaQuery('(orientation: portrait)')
    return <List sx={{ marginRight: "auto", marginLeft: "auto" }}>
        <DenseOnboardingProgressListItem
            text={`Select the "Settings" tab ${ portrait ? "above" : "to the left" }.`}
            index={0}
            completed={true}
        />
        <DenseOnboardingProgressListItem
            text={`Select the "Home" tab ${ portrait ? "above" : "to the left" }.`}
            index={1}
            completed={false}
        />
    </List>
}

export const OnboardingDisplay: FunctionComponent<{}> = ({ children }) => {
    //
    // TODO: Add Header message creating narrative and call-to-action
    // TODO: Create Lockout mode for Create and Play
    //
    return <React.Fragment>
        <Box sx={{ width: "80%", maxWidth: "40em", marginLeft: "auto", marginRight: "auto", marginTop: "0.5em", backgroundColor: blue[300], padding: "0.5em", borderRadius: "0.5em" }}>
            <Typography variant='body1' align='left'>
                Welcome to this Make The World instance. Familiarize yourself with the way that you can navigate around
                the application itself:
            </Typography>
            <Box sx={{ width: "100%" }}><DenseOnboardingProgressList /></Box>
        </Box>
        { children }
    </React.Fragment>

}

export default OnboardingDisplay
