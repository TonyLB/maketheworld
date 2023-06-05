import React, { FunctionComponent, ReactElement, useCallback, useMemo, useState } from "react"

// MaterialUI imports
import { blue } from '@mui/material/colors'
import {
    Box,
    Typography,
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
    ListItemButton,
    ListItemIcon,
    Divider,
    FormGroup,
    FormControlLabel,
    Switch
} from "@mui/material"
import ArrowBack from '@mui/icons-material/ArrowBackIos'
import CheckIcon from '@mui/icons-material/Check'
import DotsIcon from '@mui/icons-material/MoreHoriz'
import QuestionMarkIcon from '@mui/icons-material/QuestionMark'
import LockIcon from '@mui/icons-material/Lock'
import { useOnboardingCheckpoint, useOnboardingPage } from "./useOnboarding"
import { getMySettings, getOnboardingPage, getActiveOnboardingChapter } from "../../slices/player"
import { useDispatch, useSelector } from "react-redux"
import { OnboardingKey, onboardingChapters, onboardingCheckpointSequence } from "./checkpoints"
import { addOnboardingComplete, removeOnboardingComplete, updateOnboardingComplete } from "../../slices/player/index.api"
import { getClientSettings, putClientSettings } from "../../slices/settings"

type DenseOnboardingProgressListItemProperties = {
    text: ReactElement | string;
    icon?: ReactElement;
    index: number;
    completed: boolean;
}

const DenseOnboardingProgressListItem: FunctionComponent<DenseOnboardingProgressListItemProperties> = ({ text, icon, index, completed }) => {
    return <ListItem sx={{ width: "100%" }}>
        <ListItemAvatar sx={{ minWidth: "2em" }}><Avatar sx={{ width: "1em", height: "1em", bgcolor: blue[600], color: 'black' }}>{completed ? <CheckIcon fontSize="small" /> : <Typography variant="body2">{index + 1}</Typography>}</Avatar></ListItemAvatar>
        { typeof text === 'string'
            ? <ListItemText sx={{ flexGrow: 1 }}>{text}</ListItemText>
            : text
        }
        { icon && <Box sx={{ background: blue[100], marginLeft: "0.5em", padding: "0.25em", borderRadius: "0.25em" }}>{icon}</Box> }
    </ListItem>
}

type DenseOnboardingProgressListProperties = {
    listItems: Partial<Record<OnboardingKey, { text: ReactElement | string; icon?: ReactElement }>>;
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
            text: listItems[key]?.text ?? '',
            icon: listItems[key]?.icon,
            index,
            completed: onboardCompleteByKey[key]
        }))
    return <List sx={{ marginRight: "auto", marginLeft: "auto" }}>
        { listUnwrapped.map(({ key, text, icon, index, completed }) => (
            <DenseOnboardingProgressListItem
                key={key}
                text={text}
                icon={icon}
                index={index}
                completed={completed}
            />
        ))}
    </List>
}

const AlwaysShowOnboarding: FunctionComponent<{}> = () => {
    const { AlwaysShowOnboarding } = useSelector(getClientSettings)
    const dispatch = useDispatch()
    const onAlwaysShowOnboardingChange = useCallback((value: boolean) => {
        dispatch(putClientSettings({ AlwaysShowOnboarding: value }))
    }, [dispatch])
    return <FormGroup sx={{ marginLeft: '1em' }}>
        <FormControlLabel
            control={
                <Switch
                    checked={AlwaysShowOnboarding}
                    onChange={(event) => { onAlwaysShowOnboardingChange(event.target.checked) }}
                />
            }
            label="Show Onboarding on all pages"
        />
    </FormGroup>
}

export const useOnboardingDispatcher = (): undefined | { text: string | ReactElement; listItems: Partial<Record<OnboardingKey, { text: ReactElement | string; icon?: ReactElement }>>} => {
    const portrait = useMediaQuery('(orientation: portrait)')
    const large = useMediaQuery('(min-height:600px)')
    const page = useOnboardingPage()
    return useMemo(() => {
        if (!page) {
            return undefined
        }
        return {
            text: typeof page.text === 'function' ? page.text({ portrait, large, alwaysShowSetting: <AlwaysShowOnboarding /> }) : page.text,
            listItems: page.subItems.reduce<Partial<Record<OnboardingKey, { text: ReactElement | string; icon?: ReactElement }>>>((previous, { key, text, icon }) => {
                const adjustedText: ReactElement | string = typeof text === 'function' ? text({ portrait, large, alwaysShowSetting: <AlwaysShowOnboarding /> }) : text
                return {
                    ...previous,
                    [key as OnboardingKey]: {
                        text: adjustedText,
                        icon
                    }
                }
            }, {})
        }
    }, [page, portrait, large])
}

type OnboardingPanelProps = {
    wrapper?: boolean
}

export const OnboardingPanel: FunctionComponent<OnboardingPanelProps> = ({ children, wrapper = false }) => {
    const { text, listItems } = useOnboardingDispatcher() ?? { text: '', listItems: {} }
    const dispatch = useDispatch()
    const { currentChapter } = useSelector(getActiveOnboardingChapter)
    const page = useSelector(getOnboardingPage)
    const backOnClick = useCallback(() => {
        if (page.index > 0) {
            const toRemove = [currentChapter.pages[page.index - 1].pageKey, ...page.subItems.map(({ key }) => (key))]
            dispatch(removeOnboardingComplete(toRemove))
        }
    }, [page, currentChapter])
    const { onboardCompleteTags } = useSelector(getMySettings)
    const pageTasksComplete = !Boolean((page?.subItems || []).find(({ key }) => (!(onboardCompleteTags.includes(key)))))
    const skipOnClick = useCallback(() => {
        dispatch(addOnboardingComplete([...(page.last ? [] : [page.pageKey]), ...page.subItems.map(({ key }) => (key))] as OnboardingKey[]))
    }, [page])
    const nextOnClick = useCallback(() => {
        dispatch(addOnboardingComplete([page.pageKey] as OnboardingKey[]))
    }, [page])
    const finishOnClick = useCallback(() => {
        dispatch(updateOnboardingComplete({
            addTags: [`end${currentChapter.chapterKey}`] as OnboardingKey[],
            removeTags: [`active${currentChapter.chapterKey}`] as OnboardingKey[]
        }))
    }, [page, currentChapter])
    return <Stack sx={{ height: "100%" }}>
        { page && 
            <Card sx={{ ...(wrapper ? { maxHeight: "30vh", overflowY: "auto" } : {}), width: "80%", maxWidth: "40em", marginLeft: "auto", marginRight: "auto", marginTop: "0.5em", backgroundColor: blue[300], padding: "0.5em", borderRadius: "0.5em" }}>
                <CardContent sx={{ position: "relative", height: "100%", paddingBottom: "3em", marginBottom: "-3em" }}>
                    <Box sx={{ overflowY: "auto", maxHeight: "100%" }}>
                        <Typography component="div" variant='body1' align='left'>
                            {text}{ Object.keys(listItems).length ? ':' : ''}
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
                        { (!page.first) && <Button variant="contained" onClick={backOnClick}>Back</Button> }
                        <Box sx={{ flexGrow: 1 }} />
                        { pageTasksComplete
                            ? page.last
                                ? <Button variant="contained" onClick={finishOnClick}>Finish</Button>
                                : <Button variant="contained" onClick={nextOnClick}>Next</Button>
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

export const OnboardingHome: FunctionComponent<{}> = () => {
    const { onboardCompleteTags = [] } = useSelector(getMySettings)
    const dispatch = useDispatch()
    const activate = useCallback((key: string) => {
        dispatch(updateOnboardingComplete({
            addTags: [`start${key}`, `active${key}`],
            removeTags: [`end${key}`]
        }))
    }, [dispatch])
    return <Stack sx={{ height: "100%", margin: "1em" }}>
        <Divider />
            <Typography variant="h4" sx={{ margin: "0.5em" }}>
                Onboarding Chapters
            </Typography>
        <Divider />
        <List>
            {
                onboardingChapters.map(({ chapterKey, title, lock }) => (
                    <ListItem key={chapterKey}>
                        <ListItemButton onClick={() => {
                            if (lock && !onboardCompleteTags.includes(lock)) {
                                return
                            }
                            activate(chapterKey)
                        }}>
                            <ListItemIcon>
                                {
                                    onboardCompleteTags.includes(`end${chapterKey}`)
                                        ? <CheckIcon />
                                        : lock && !onboardCompleteTags.includes(lock)
                                            ? <LockIcon />
                                            : onboardCompleteTags.includes(`start${chapterKey}`)
                                                ? <DotsIcon />
                                                : <QuestionMarkIcon />
                                }
                            </ListItemIcon>
                            <ListItemText primary={title} />
                        </ListItemButton>
                    </ListItem>
                ))
            }
        </List>
    </Stack>
}

export const Onboarding: FunctionComponent<{}> = () => {
    useOnboardingCheckpoint('navigateBack', { requireSequence: true })
    const { index, currentChapter } = useSelector(getActiveOnboardingChapter)
    const dispatch = useDispatch()
    const homeOnClick = useCallback(() => {
        dispatch(removeOnboardingComplete([`active${currentChapter.chapterKey}`] as OnboardingKey[]))
    }, [currentChapter, dispatch])
    return currentChapter
        ? <Stack sx={{ height: "100%" }}>
            { index > 0 &&
                <Stack direction="row">
                    <Button variant="contained" sx={{ marginLeft: "2em", marginTop: "0.5em" }} onClick={homeOnClick}><ArrowBack />Onboarding Home</Button>
                    <Box sx={{ flexGrow: 1 }} />
                </Stack>
            }
            <OnboardingPanel />
        </Stack>
        : <OnboardingHome />
}

export default Onboarding
