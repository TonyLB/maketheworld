import React, { FunctionComponent, useCallback, useMemo } from "react"

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
    Button
} from "@mui/material"
import CheckIcon from '@mui/icons-material/Check'
import useOnboarding, { useNextOnboarding } from "./useOnboarding"
import { getMySettings } from "../../slices/player"
import { useDispatch, useSelector } from "react-redux"
import { OnboardingKey, onboardingCheckpointSequence } from "./checkpoints"
import { addOnboardingComplete, removeOnboardingComplete } from "../../slices/player/index.api"

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
                    text: 'Good job! The navigation bar will let you navigate in the application, and keep track of any content windows you open. Explore opening temporary content windows',
                    listItems: {
                        navigateKnowledge: `Select the "Knowledge" button in the "Explore" section below.`,
                        knowledgeDetail: `Select any sub-heading in the Knowledge display, to navigate within the tab.`,
                        closeTab: `Browse knowledge as long as you like, and when you're ready to explore the world directly, close the knowledge tab (${ portrait ? "above" : "at left" }) by pressing the 'X' on it.`
                    }
                }
            case 'navigatePlay':
                return {
                    text: `Congratulations! Navigation tabs will help keep things organized if you start doing a lot with the application, and Knowledge will tell you about the specific world of this instance. But that's not the only way to learn about the world. You can also explore by taking on the role of a character in the world itself`,
                    listItems: {
                        navigatePlay: `On the Home tab, select a character to play them in the virtual world.`
                    }
                }
            case 'commandMode':
            case 'sayMode':
            case 'narrateMode':
            case 'OOCMode':
                return {
                    text: 'Here you are, playing a role in the world alongside everybody else. You control your character, and "see" through their eyes. One of the ways you can make things happen is through the input field at the bottom of the page. Give it a try',
                    listItems: {
                        commandMode: `Your input field (bottom) defaults to Command mode. Focus into that field, type 'look' and hit enter.`,
                        sayMode: `The input field has a mode selector (bottom right) with up and down arrows. Press the up arrow once (or press the " key) to enter Say mode, and type something for your character to say (like "Hi!")`,
                        narrateMode: `Press the up arrow twice (or press the : key) to enter Narrate mode, and type something that should be narrated happening in the room (like "Nathan looks around.")`,
                        OOCMode: `Press the up arrow three times (or press the \\ key) to enter out-of-character mode, and type something that should be shared with other players nearby, outside the story (like "I'm new here")`
                    }
                }
            case 'featureLink':
            case 'exitLink':
            case 'actionLink':
                return {
                    text: `Looks like you've got the hang of the input field! You'll see a description of the room your character is in, below (and pinned to the top if it scrolls too far). You can explore many things (and make things happen) through links embedded directly in description text. Explore those options`,
                    listItems: {
                        featureLink: `Some features in the description of the room are highlighted. Press one of those highlights to see a description of further detail.`,
                        exitLink: `On the left, below the description of the room, are exits to other places. Press one of those exits to leave this room and go to another.`,
                        actionLink: `Somewhere in the details of this room you will find highlights on something you could DO (like "ring the bell"). Press one of those highlights to take action in the world.`
                    }
                }
            case 'navigateHomeInPlay':
            case 'navigateLibrary':
                return {
                    text: `You're really getting how to play a role in the world. Plenty of people enjoy doing that alone (and if that's you, you can skip the rest of the onboarding). Others enjoy adding to the world as well. Explore the options for expanding the world`,
                    listItems: {
                        navigateHomeInPlay: `Use the navigation tabs to return to the Home page.`,
                        navigateLibrary: `Select the "Library" button in the "Create" section below.`
                    }
                }
            case 'createAsset':
            case 'nameAsset':
            case 'editAsset':
                return {
                    text: `This is the Library in which Make The World organizes the Assets that make the game. Assets are layers of description on rooms, features, etc., that are laid on one another successively to create the final world. You can create Personal Assets whose content is seen only by you, to test out creations. Let's give it a try`,
                    listItems: {
                        createAsset: 'In the Personal section, below, click Add Asset.',
                        nameAsset: 'Give the new Asset an unique name (this may take some trying ... the name must be globally unique)',
                        editAsset: 'Select the Asset in the list, and you will see a preview pane appear. Click the "Edit" button on that preview pane to make this Asset the one you are globally editing.'
                    }
                }
            case 'addRoom':
            case 'navigateRoom':
            case 'nameRoom':
            case 'describeRoom':
                return {
                    text: `You have created a personal asset that you can make private changes in. The Asset Editor can be daunting, but you'll start small. Create a new room of your own invention to include in the world`,
                    listItems: {
                        addRoom: `In the Rooms subsection, below, click the Add Room button, and give the room an internal key.`,
                        navigateRoom: `Click the new (Untitled) room item to navigate to its detail editor.`,
                        nameRoom: 'Enter a name for the room.',
                        describeRoom: 'Enter a description for the room.'
                    }
                }
            case 'navigatePlayWithAsset':
            case 'importRoom':
                return {
                    text: `Now you can find a place already in the world, and attach your room nearby. The easiest way to do that is straight from the world itself. Give it a go`,
                    listItems: {
                        navigatePlayWithAsset: 'Use the Navigation tabs to go back to the page where you are playing a character.',
                        importRoom: 'You will note that room descriptions now include an "Edit" button. Pick a room you want to expand the world from, and click the Edit button on that room.'
                    }
                }
            case 'navigateAssetWithImport':
            case 'addExit':
            case 'addExitBack':
                return {
                    text: `You've told Make The World that your Personal Asset will not only create your new room, it will also add content to an already existing room. Now you can change that room to make it possible to travel from there to your new room`,
                    listItems: {
                        navigateAssetWithImport: `If needed, navigate back to the library and select the imported room to get to its detail editor.`,
                        addExit: `In the Exits section, click "Add Exit". Give the exit a descriptive name, and select the key of the room you created as a destination.`,
                        addExitBack: `Click enter in the exit name, and you should be given an exit back from your created room to the room you imported. Give that a descriptive name as well.`
                    }
                }
            case 'saveAsset':
            case 'navigatePlayWithPersonalRoom':
            case 'navigatePersonalRoom':
                return {
                    text: `You have a draft of a new creation for the shared world, now it's time to let the system know about it, and see it in play`,
                    listItems: {
                        saveAsset: `Close the detail editor and return to the main table-of-contents for your new Asset. Press the "Save" button at upper right to send your draft to the system.`,
                        navigatePlayWithPersonalRoom: `Close the Asset, and navigate back to your In-Play window. The new exit you created should be visible in the room you chose.`,
                        navigatePersonalRoom: 'Press that exit to travel to your new room.'
                    }
                }
            case 'closeOnboarding':
                return {
                    text: `Congratulations!  You have learned how to use the Make The World application. You can restart this tutorial in the Settings tab any time you need a refresher, and you can always ask your fellow players for advice on the details of the system. Otherwise, you're ready to enjoy telling stories and creating settings together, in Make The World.`,
                    listItems: {
                    }
                }
        }
    }, [next])
}

export const OnboardingDisplay: FunctionComponent<{}> = ({ children }) => {
    const next = useNextOnboarding()
    const { text, listItems } = useOnboardingDispatcher() ?? { text: '', listItems: {} }
    const { output: previous } = onboardingCheckpointSequence.slice(0, -1).reduce<{ output?: string; finished: boolean }>((previous, key) => {
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
            dispatch(removeOnboardingComplete([previous, ...Object.keys(listItems)]))
        }
    }, [previous, listItems])
    const skipOnClick = useCallback(() => {
        dispatch(addOnboardingComplete(Object.keys(listItems)))
    }, [listItems])
    return <Stack sx={{ height: "100%" }}>
        { next && 
            <Card sx={{ width: "80%", maxWidth: "40em", maxHeight: "40%", marginLeft: "auto", marginRight: "auto", marginTop: "0.5em", backgroundColor: blue[300], padding: "0.5em", borderRadius: "0.5em" }}>
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
                        { next !== 'closeOnboarding' && <Button variant="contained" onClick={skipOnClick}>Skip</Button> }
                    </Stack>
                </CardActions>
            </Card>
        }
        <Box sx={{ position: "relative", flexGrow: 1 }}>
            { children }
        </Box>
    </Stack>
}

export default OnboardingDisplay
