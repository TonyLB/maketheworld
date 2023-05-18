import React, { FunctionComponent, ReactElement, useCallback, useMemo } from "react"

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
    ListItemText,
    Card,
    CardContent,
    Stack,
    CardActions,
    Button,
    Breadcrumbs,
    Link
} from "@mui/material"
import CheckIcon from '@mui/icons-material/Check'
import useOnboarding, { useNextOnboarding, useOnboardingPage } from "./useOnboarding"
import { getMySettings } from "../../slices/player"
import { useDispatch, useSelector } from "react-redux"
import { OnboardingKey, onboardingCheckpointSequence } from "./checkpoints"
import { addOnboardingComplete, removeOnboardingComplete } from "../../slices/player/index.api"
import { useNavigate } from "react-router-dom"

type DenseOnboardingProgressListItemProperties = {
    text: ReactElement | string;
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
    listItems: Partial<Record<OnboardingKey, ReactElement | string>>;
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

export const useOnboardingDispatcher = (): undefined | { text: string | ReactElement; listItems: Partial<Record<OnboardingKey, ReactElement | string>>} => {
    const portrait = useMediaQuery('(orientation: portrait)')
    const page = useOnboardingPage()
    return useMemo(() => {
        if (!page) {
            return undefined
        }
        return {
            text: typeof page.text === 'function' ? page.text({ portrait }) : page.text,
            listItems: page.subItems.reduce<Partial<Record<OnboardingKey, ReactElement | string>>>((previous, { key, text }) => {
                const adjustedText: ReactElement | string = typeof text === 'function' ? text({ portrait }) : text
                return {
                    ...previous,
                    [key as OnboardingKey]: adjustedText
                }
            }, {})
        }
    }, [page])
}

export const OnboardingPanel: FunctionComponent<{}> = ({ children }) => {
    const { text, listItems } = useOnboardingDispatcher() ?? { text: '', listItems: {} }
    const { output: previous } = onboardingCheckpointSequence.slice(0, -1).reduce<{ output?: OnboardingKey; finished: boolean }>((previous, key) => {
        if (key in listItems) {
            return {
                ...previous,
                finished: true
            }
        }
        else {
            if (previous.finished) {
                return previous
            }
            else {
                return {
                    ...previous,
                    output: key,
                }
            }
        }
    }, { finished: false })
    const dispatch = useDispatch()
    const backOnClick = useCallback(() => {
        if (previous) {
            dispatch(removeOnboardingComplete([previous, ...Object.keys(listItems) as OnboardingKey[]]))
        }
    }, [previous, listItems])
    const page = useOnboardingPage()
    const { onboardCompleteTags } = useSelector(getMySettings)
    const pageTasksComplete = !Boolean(page.subItems.find(({ key }) => (!(onboardCompleteTags.includes(key)))))
    const skipOnClick = useCallback(() => {
        dispatch(addOnboardingComplete([page.pageKey, ...page.subItems.map(({ key }) => (key))] as OnboardingKey[]))
    }, [listItems])
    const nextOnClick = useCallback(() => {
        dispatch(addOnboardingComplete([page.pageKey] as OnboardingKey[]))
    }, [listItems])
    const navigate = useNavigate()
    return <Stack sx={{ height: "100%" }}>
        <Breadcrumbs aria-label="navigation breadcrumbs">
            <Link
                sx={{ cursor: 'pointer' }}
                underline="hover"
                color="inherit"
                onClick={() => { navigate(`/Onboarding/`) }}
            >
                OnboardingHome
            </Link>
        </Breadcrumbs>
        { page && 
            <Card sx={{ width: "80%", maxWidth: "40em", marginLeft: "auto", marginRight: "auto", marginTop: "0.5em", backgroundColor: blue[300], padding: "0.5em", borderRadius: "0.5em" }}>
                <CardContent sx={{ position: "relative", height: "100%", paddingBottom: "3em", marginBottom: "-3em" }}>
                    <Box sx={{ overflowY: "auto", maxHeight: "100%" }}>
                        <Typography variant='body1' align='left'>
                            {text}:
                        </Typography>
                        <Box sx={{ width: "100%" }}>
                            <DenseOnboardingProgressList
                                listItems={listItems}
                            />
                        </Box>
                    </Box>
                </CardContent>
                <CardActions>
                    <Stack direction="row" sx={{ width: "100%" }}>
                        { previous && <Button variant="contained" onClick={backOnClick}>Back</Button> }
                        <Box sx={{ flexGrow: 1 }} />
                        { pageTasksComplete
                            ? <Button variant="contained" onClick={nextOnClick}>Next</Button>
                            : <Button variant="contained" onClick={skipOnClick}>Skip</Button>
                        }
                    </Stack>
                </CardActions>
            </Card>
        }
        <Box sx={{ position: "relative", flexGrow: 1 }}>
            { children }
        </Box>
    </Stack>
}

export default OnboardingPanel

export const OnboardingHome: FunctionComponent<{}> = () => {
    return <Stack sx={{ height: "100%" }}>

    </Stack>
}