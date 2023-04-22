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
import useOnboarding from "./useOnboarding"
import { getMySettings } from "../../slices/player"
import { useSelector } from "react-redux"
import { OnboardingKey, onboardingCheckpointSequence } from "./checkpoints"

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
    listItems: Partial<Record<OnboardingKey, string>>;
}

const DenseOnboardingProgressList: FunctionComponent<DenseOnboardingProgressListProperties> = ({ listItems }) => {
    const { onboardCompleteTags = [] } = useSelector(getMySettings)
    const onboardCompleteByKey = onboardingCheckpointSequence.reduce<Record<OnboardingKey, boolean>>((previous, key) => ({
        ...previous,
        [key]: onboardCompleteTags.includes(key)
    }), {} as Record<OnboardingKey, boolean>)
    const listUnwrapped = onboardingCheckpointSequence
        .filter((key) => (key in listItems))
        .map((key, index) => ({
            key,
            text: listItems[key],
            index,
            completed: onboardCompleteByKey[key]
        }))
    return <List sx={{ marginRight: "auto", marginLeft: "auto" }}>
        { listUnwrapped.map(({ key, text, index, completed }) => (
            <DenseOnboardingProgressListItem
                key={key}
                text={text}
                index={index}
                completed={completed}
            />
        ))}
    </List>
}

export const OnboardingDisplay: FunctionComponent<{}> = ({ children }) => {
    //
    // TODO: Create Lockout mode for Create and Play
    //
    const portrait = useMediaQuery('(orientation: portrait)')
    return <React.Fragment>
        <Box sx={{ width: "80%", maxWidth: "40em", marginLeft: "auto", marginRight: "auto", marginTop: "0.5em", backgroundColor: blue[300], padding: "0.5em", borderRadius: "0.5em" }}>
            <Typography variant='body1' align='left'>
                Welcome to this Make The World instance. Familiarize yourself with the way that you can navigate around
                the application itself:
            </Typography>
            <Box sx={{ width: "100%" }}>
                <DenseOnboardingProgressList
                    listItems={{
                        navigateSettings: `Select the "Settings" tab ${ portrait ? "above" : "to the left" }.`,
                        navigateHome: `Select the "Home" tab ${ portrait ? "above" : "to the left" }.`
                    }}
                />
            </Box>
        </Box>
        { children }
    </React.Fragment>

}

export default OnboardingDisplay
