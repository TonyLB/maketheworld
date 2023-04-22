import React, { FunctionComponent, useMemo } from "react"

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
import useOnboarding, { useNextOnboarding } from "./useOnboarding"
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

export const useOnboardingDispatcher = (): undefined | { text: string; listItems: Partial<Record<OnboardingKey, string>>} => {
    const portrait = useMediaQuery('(orientation: portrait)')
    const next = useNextOnboarding()
    return useMemo(() => {
        if (!next) {
            return undefined
        }
        switch(next) {
            case 'navigateSettings':
            case 'navigateHome':
                return {
                    text: 'Welcome to this Make The World instance. Familiarize yourself with the way that you can navigate around the application itself',
                    listItems: {
                        navigateSettings: `Select the "Settings" tab ${ portrait ? "above" : "to the left" }.`,
                        navigateHome: `Select the "Home" tab ${ portrait ? "above" : "to the left" }.`
                    }
                }
            case 'navigateKnowledge':
            case 'knowledgeDetail':
            case "closeTab":
                return {
                    text: 'Good job! The navigation bar will let you navigate in the application, and keep track of any content windows you open. Examine opening temporary content windows',
                    listItems: {
                        navigateKnowledge: `Select the "Knowledge" button below.`,
                        knowledgeDetail: `Select any sub-heading in the Knowledge display, to navigate within the tab.`,
                        closeTab: `Close the knowledge tab (${ portrait ? "above" : "at left" }) by pressing the 'X' on it.`
                    }
                }
        }
    }, [next])
}

export const OnboardingDisplay: FunctionComponent<{}> = ({ children }) => {
    //
    // TODO: Create Lockout mode for Create and Play
    //
    const { text, listItems } = useOnboardingDispatcher() ?? { text: '', listItems: {} }
    const portrait = useMediaQuery('(orientation: portrait)')
    return <React.Fragment>
        <Box sx={{ width: "80%", maxWidth: "40em", marginLeft: "auto", marginRight: "auto", marginTop: "0.5em", backgroundColor: blue[300], padding: "0.5em", borderRadius: "0.5em" }}>
            <Typography variant='body1' align='left'>
                {text}:
            </Typography>
            <Box sx={{ width: "100%" }}>
                <DenseOnboardingProgressList
                    listItems={listItems}
                />
            </Box>
        </Box>
        { children }
    </React.Fragment>

}

export default OnboardingDisplay
