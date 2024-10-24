import React, { ReactElement } from "react"
import { Stack, Typography, Chip } from "@mui/material"
import HomeIcon from '@mui/icons-material/Home'
import OnboardingIcon from '@mui/icons-material/Lightbulb'
import KnowledgeIcon from '@mui/icons-material/MenuBook'
import CloseIcon from '@mui/icons-material/Close'
import SayMessageIcon from '@mui/icons-material/Chat'
import NarrateMessageIcon from '@mui/icons-material/Receipt'
import OOCMessageIcon from '@mui/icons-material/CropFree'
import CommandIcon from '@mui/icons-material/Code'
import ExitIcon from '@mui/icons-material/ExitToApp'
import RenameIcon from "../Maps/Edit/MapLayers/RenameIcon"
import EditIcon from '@mui/icons-material/Edit'
import TwoWayExitIcon from '@mui/icons-material/SyncAlt'

type DeepReadonly<T> =
    T extends (infer R)[] ? DeepReadonlyArray<R> :
    T extends Function ? T :
    T extends object ? DeepReadonlyObject<T> :
    T

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
}

type OnboardingText = ReactElement | string | ((arg: OnboardingTextArgument) => ReactElement | string)

export type OnboardingSubItem = {
    key: string;
    text?: OnboardingText;
    popoverText?: OnboardingText;
    icon?: ReactElement;
}

type OnboardingPage = {
    pageKey: string;
    text?: OnboardingText;
    subItems: OnboardingSubItem[];
}

type OnboardingChapter = {
    chapterKey: string;
    title: string;
    lock?: string;
    pages: OnboardingPage[];
}

type OnboardingTextArgument = {
    portrait: boolean;
    large: boolean;
    alwaysShowSetting: ReactElement;
}

const onboardingChaptersRaw = [
    {
        chapterKey: 'MTWNavigation',
        title: 'Navigate in Make The World',
        pages: [
            {
                pageKey: 'pageOnboarding',
                text: ({ large, alwaysShowSetting }) => (
                    <React.Fragment>
                        Welcome to this community, hosted on Make The World! We're glad you're here!
                        <br /><br />
                        Make The World is a system for helping people to create stories together ... from collaborating on settings through
                        to playing the parts of fictional characters as they each make an impact.
                        <br /><br />
                        These onboarding tutorials will step you through how to use Make The World to explore what other members have created
                        of the world, take part in stories, and make up your own new ideas to share.
                        
                        { large && <React.Fragment>
                            <br /><br />
                            You've got a lot of screen real-estate: Would you like to always show the tutorial on-screen, so you can follow along easily, 
                            matter what part of the application you're looking at?  You can always adjust that setting later in Settings.
                            <br /><br />{ alwaysShowSetting }
                        </React.Fragment> }
                    </React.Fragment>
                ),
                subItems: []
            },
            {
                pageKey: 'pageNavigateTabs',
                text: 'Welcome to this Make The World instance. Familiarize yourself with the way that you can navigate around the application itself',
                subItems: [
                    {
                        key: 'navigateHome',
                        text: ({ portrait }) => (`Select the "Home" tab ${ portrait ? "above" : "to the left" }`),
                        icon: <Stack sx={{ alignItems: 'center' }}><HomeIcon fontSize="small" /><Typography sx={{ fontSize: "8pt" }}>HOME</Typography></Stack>
                    },
                    {
                        key: 'navigateBack',
                        text: ({ portrait }) => (`Select the "Tutorials" tab ${ portrait ? "above" : "to the left" } in order to return.`),
                        icon: <Stack sx={{ alignItems: 'center' }}><OnboardingIcon fontSize="small" /><Typography sx={{ fontSize: "8pt" }}>ONBOARDING</Typography></Stack>
                    }
                ]
            },
            {
                pageKey: 'pageTemporaryTabs',
                text: 'Good job! The navigation bar will let you navigate in the application, and keep track of any content windows you open. Explore opening temporary content windows',
                subItems: [
                    {
                        key: 'returnHome',
                        text: `Select the "Home" tab again`,
                        icon: <Stack sx={{ alignItems: 'center' }}><HomeIcon fontSize="small" /><Typography sx={{ fontSize: "8pt" }}>HOME</Typography></Stack>
                    },
                    {
                        key: 'navigateKnowledge',
                        text: <React.Fragment>Select the "Knowledge" button in the "Explore" section below.</React.Fragment>,
                        icon: <Stack sx={{ alignItems: 'center' }}><KnowledgeIcon fontSize="small" /><Typography sx={{ fontSize: "8pt" }}>Knowledge</Typography></Stack>
                    },
                    {
                        key: 'knowledgeDetail',
                        text: <React.Fragment>Select any sub-heading in the Knowledge display, to navigate within the tab.</React.Fragment>
                    },
                    {
                        key: 'closeTab',
                        text: ({ portrait }) => (<React.Fragment>Browse knowledge as long as you like, and when you're ready to explore the world directly, close the knowledge tab ({ portrait ? "above" : "at left" }) by pressing the 'X' on it.</React.Fragment>),
                        icon: <CloseIcon fontSize="small" />
                    }
                ]
            },
            {
                pageKey: 'pageMTWNavigationCongratulations',
                text: <React.Fragment>
                    Congratulations! Navigation tabs will help keep things organized if you start doing a lot with the application, and Knowledge will tell you about the specific world of this instance.
                    <br /><br />
                    But that's not the only way to learn about the world. There are more tutorials to lead you through more of Make The World's features.
                </React.Fragment>,
                subItems: []
            }
        ]
    },
    {
        chapterKey: 'PlayCharacter',
        title: 'Play the role of a character',
        pages: [
            {
                pageKey: 'pageRole',
                text: <React.Fragment>
                    You can also explore by taking on the role of a character in the world itself. When you play a role, you control what your character contributes to the story in each given instant, deciding
                    what they say or attempt. You also "see" the world presented through their eyes, which lets you explore in much more depth than the knowledge base.
                    <br /><br />
                    Playing a character can be a bit more daunting than reading the game encyclopedia, though, because you aren't (necessarily) alone. Make The World supports a <b>community</b> of storytellers
                    sharing the same world, so there's a decent chance that you'll bump into other people playing their own characters. This section will help you to learn the basics of responding (for instance,
                    when someone else says "hello") and exploring.
                </React.Fragment>,
                subItems: []
            },
            {
                pageKey: 'pageGuest',
                text: <React.Fragment>
                    To help make sure everyone knows to welcome you, each new player starts with a "guest" character all of their own, to experiment in the world. Everyone has been a guest at some point,
                    so they know not to expect expertise about either Make The World, or their particular story. Usually they will be eager to help you learn about everything.
                    <br /><br />
                    However, it's expected that guest characters are just for that sort of tourism:  They're not intended to be part of the ongoing stories. When you feel comfortable, and want to start
                    making things happen in the world in a way that lasts, you'll want to (probably) check out one of the characters available in the public library, created to fit into the story from
                    the start, or (if you're adventurous) create your own character from scratch.
                    <br /><br />
                    For the purposes of this tutorial, though, the guest character is perfectly adequate.
                </React.Fragment>,
                subItems: []
            },
            {
                pageKey: 'pageInCharacter',
                text: `Head back to the home page, where your characters are available to play. Most players only ever use one character at a time, but there's no real limit (as long as you're not playing so many roles that people find it hard to actually share the story with you ... if you want to write all the characters, a novel might be a better format).`,
                subItems: [
                    {
                        key: 'navigatePlay',
                        text: 'On the Home tab, under the "Play" section, select a character in order to play them in the virtual world.'
                    }
                ]
            },
            {
                pageKey: 'pageLineEntryModes',
                text: 'Here you are, playing a role in the world alongside everybody else. You control your character, and "see" through their eyes. One of the ways you can make things happen is through the input field at the bottom of the page. Give it a try',
                subItems: [
                    {
                        key: 'commandMode',
                        text: <React.Fragment>Your input field (bottom) defaults to Command mode. Focus into that field, type 'look' and hit enter. As the Make The World software evolves, there will be many more possibilities in this mode, but today it's pretty sparse.</React.Fragment>,
                        icon: <CommandIcon fontSize="small" />
                    },
                    {
                        key: 'sayMode',
                        text: <React.Fragment>The input field has a mode selector (bottom right) with up and down arrows. Press the up arrow once (or press the " key) to enter Say mode, and type something for your character to say (like "Hi!")</React.Fragment>,
                        icon: <SayMessageIcon fontSize="small" />
                    },
                    {
                        key: 'narrateMode',
                        text: <React.Fragment>Press the up arrow twice (or press the : key) to enter Narrate mode, and type something that should be narrated happening in the room (like "Riley looks around.")</React.Fragment>,
                        icon: <NarrateMessageIcon fontSize="small" />
                    },
                    {
                        key: 'OOCMode',
                        text: `Press the up arrow three times (or press the \\ key) to enter out-of-character mode, and type something that should be shared with other players nearby, outside the story (like "I'm new here")`,
                        icon: <OOCMessageIcon fontSize="small" />
                    }
                ]
            },
            {
                pageKey: 'pageInPlayClicks',
                text: `Looks like you've got the hang of the input field! You'll see a description of the room your character is in, below (and pinned to the top if it scrolls too far). You can explore many things (and make things happen) through links embedded directly in description text. Explore those options`,
                subItems: [
                    {
                        key: 'featureLink',
                        text: `Some features in the description of the room are highlighted. Press one of those highlights to see a description of further detail.`
                    },
                    {
                        key: 'exitLink',
                        text: `On the left, below the description of the room, are exits to other places. Press one of those exits to leave this room and go to another.`,
                        icon: <Chip label="out" icon={<ExitIcon fontSize="small" />} />
                    },
                    {
                        key: 'actionLink',
                        text: `Somewhere in the details of this room you will find highlights on something you could DO (like "ring the bell"). Press one of those highlights to take action in the world.`
                    }
                ]
            },
            {
                pageKey: 'pagePlayCharacterCongratulations',
                text: `Congratulations! You've mastered the basic tools of telling a story and exploring the world with your character. These are the fundamental tools of interacting with any Make The World community: They each support different worlds of story-telling in real time, and welcome you to be part of that effort.`,
                subItems: []
            }
        ]
    },
    {
        chapterKey: 'CreateAsset',
        title: 'Make changes to the world',
        pages: [
            {
                pageKey: 'pageCreateAssetIntro',
                text: `Plenty of people enjoy just playing roles in the story (and if that's you, you can skip this tutorial). Others enjoy adding to the world as well. This tutorial will introduce you to Make The World's tools for editing the world. Don't worry about what people think of your creations: All edits start out in a sandbox mode where only you can see or interact with them. Sharing them with others and publishing them broadly are beyond the scope of this tutorial.`,
                subItems: []
            },
            {
                pageKey: 'pageLibrary',
                text: `First you need to find a place to start making changes. One easy way to do that is to start from where one of your characters is standing`,
                subItems: [
                    {
                        key: 'navigateHomeInPlay',
                        text: `Use the navigation tabs to return to the Home page.`,
                        popoverText: `Click here to return to the Home page.`
                    },
                    {
                        key: 'navigateInPlayEdit',
                        text: 'On the Home tab, under the "Play" section, select a character in order to see their perspective in the virtual world.',
                        popoverText: 'Select a character in order to see their perspective in the virtual world.'
                    }
                ]
            },
            {
                pageKey: 'pageMapView',
                text: `It helps to get a better sense of your surroundings before figuring out where to add a new place. Get to the map view in play`,
                subItems: [
                    {
                        key: 'openMap',
                        text: 'Either enter "map" in command mode, or click the "..." options button on bottom right and select the map icon.',
                        popoverText: `Type "map" here to show the map.`
                    },
                    {
                        key: 'editMap',
                        text: 'In the upper right corner, select the pencil button to edit this map and add your own ideas to it.',
                        icon: <EditIcon />,
                        popoverText: `Click here to edit this map and add your own ideas.`
                    }
                ]
            },
            {
                pageKey: 'pageDraftMap',
                text: `You've created your own version of the map, inheriting from canon. Now you can add your own room into the map and connect it to existing ones`,
                subItems: [
                    {
                        key: 'addNewRoom',
                        text: 'Select the "New Room" item in the upper right, to create a new room to add into the map',
                        popoverText: `Click here to create a new room.`
                    },
                    {
                        key: 'positionNewRoom',
                        text: 'Click in the map area to position the new room',
                        popoverText: `Click in the map area to position the room.`
                    },
                    {
                        key: 'renameNewRoom',
                        text: `Find the new room in the 'Layers' section at right, and click the rename icon to rename it to something descriptive`,
                        icon: <Stack sx={{ alignItems: 'center' }}><RenameIcon /></Stack>,
                        popoverText: `Click here to rename the room to something descriptive`,
                    }
                ]
            },
            {
                pageKey: 'pageDraftExit',
                text: `Your room exists, but there is no way to get to it yet. You can add 'exits' to connect the room to existing rooms`,
                subItems: [
                    {
                        key: 'selectExitToolbar',
                        text: `Click the two-way exit icon in the map toolbar`,
                        icon: <Stack sx={{ alignItems: 'center' }}><TwoWayExitIcon /></Stack>,
                        popoverText: `Click here to switch to exit-drawing mode`
                    },
                    {
                        key: 'connectNewRoom',
                        text: 'Drag from a canon room to the new room to create exits between the two',
                        popoverText: `Drag from a canon room to the new room`
                    }
                ]
            },
            {
                pageKey: 'pageDraftRoom',
                text: `You have created a new room that you can make private changes in. The application will try to create a first guess of descriptive text, but you can edit it to more closely match your vision`,
                subItems: [
                    {
                        key: 'navigateRoom',
                        text: `In the map layers at right, click the edit button on your room to navigate to the room details.`,
                        popoverText: `Click here to edit room details`
                    },
                    {
                        key: 'summarizeRoom',
                        text: 'Edit the summary of the room that is shown when people first arrive.',
                        popoverText: `Edit the summary that is shown when people first arrive.`
                    },
                    {
                        key: 'describeRoom',
                        text: 'Edit the more detailed description that is shown if they look more closely.',
                        popoverText: 'Edit the more detailed description that is shown if they look more closely.'
                    }
                ]
            },
            {
                pageKey: 'pageDraftSave',
                text: `You have a draft of a new creation for the shared world. Once you save it, you will be able to see the changes in-play`,
                subItems: [
                    {
                        key: 'navigateBackToDraft',
                        text: `Close the detail editor and return to the Draft tab.`,
                        popoverText: 'Click here to return to the Draft tab.'
                    },
                    {
                        key: 'saveAsset',
                        text: `Press the "Save" button at upper right to send your draft to the system.`,
                        popoverText: 'Click here to save your draft to the system.'
                    },
                    {
                        key: 'navigatePlayWithPersonalRoom',
                        text: `Navigate back to your In-Play window. The new exit you created should be visible in the room you chose.`,
                        popoverText: `Navigate back to your In-Play window. The new exit you created should be visible in the room you chose.`
                    },
                    {
                        key: 'navigatePersonalRoom',
                        text: 'Press that exit to travel to your new room.',
                        popoverText: 'Press that exit to travel to your new room.'
                    }
                ]
            },
            {
                pageKey: 'pageCreateAssetCongratulations',
                text: `Congratulations! You've learned how to use Make The World to create places and extend the world. This is the basic tool that people use to generate the entire setting for shared stories.`,
                subItems: []
            }
        ]
    }
] as const

const mapper = (item: typeof onboardingChaptersRaw[number]["pages"][number]["subItems"][number]): typeof onboardingChaptersRaw[number]["pages"][number]["subItems"][number]["key"] => (item.key)

export const onboardingCheckpointSequence = [
    ...onboardingChaptersRaw.map(({ pages }) => (pages.map(({ pageKey, subItems }) => ([...subItems.map(mapper), pageKey])))).flat(2),
    'closeOnboarding'
] as const

export type OnboardingKey = typeof onboardingCheckpointSequence[number]

export const onboardingChapters = onboardingChaptersRaw as DeepReadonlyArray<OnboardingChapter>
