import React, { ReactElement } from "react";

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

type OnboardingSubItem = {
    key: string;
    text?: OnboardingText;
}

type OnboardingPage = {
    pageKey: string;
    text?: OnboardingText;
    subItems: OnboardingSubItem[];
}

type OnboardingChapter = {
    chapterKey: string;
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
        pages: [
            {
                pageKey: 'pageOnboarding',
                text: ({ large, alwaysShowSetting }) => (
                    <React.Fragment>
                        Welcome to this community, hosted on Make The World! We're glad you're here!
                        <br /><br />
                        These onboarding tutorials will step you through how to use Make The World to explore what other members have created of the world,
                        take part in stories, and make up your own new ideas to share.
                        
                        { large && <React.Fragment>
                            <br /><br />
                            You've got a lot of screen real-estate: Would you like to always show onboarding, so you can follow along easily, no matter what
                            part of the application you're looking at?  You can always adjust that setting later in Settings.
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
                        text: ({ portrait }) => (<React.Fragment>Select the "Home" tab { portrait ? "above" : "to the left" }.</React.Fragment>)
                    },
                    {
                        key: 'navigateBack',
                        text: ({ portrait }) => (<React.Fragment>Select the "Onboarding" tab { portrait ? "above" : "to the left" } in order to return.</React.Fragment>)
                    }
                ]
            },
            {
                pageKey: 'pageTemporaryTabs',
                text: 'Good job! The navigation bar will let you navigate in the application, and keep track of any content windows you open. Explore opening temporary content windows',
                subItems: [
                    {
                        key: 'navigateKnowledge',
                        text: <React.Fragment>Select the "Knowledge" button in the "Explore" section below.</React.Fragment>
                    },
                    {
                        key: 'knowledgeDetail',
                        text: <React.Fragment>Select any sub-heading in the Knowledge display, to navigate within the tab.</React.Fragment>
                    },
                    {
                        key: 'closeTab',
                        text: ({ portrait }) => (<React.Fragment>Browse knowledge as long as you like, and when you're ready to explore the world directly, close the knowledge tab ({ portrait ? "above" : "at left" }) by pressing the 'X' on it.</React.Fragment>)
                    }
                ]
            },
            {
                pageKey: 'pageMTWNavigationCongratulations',
                text: <React.Fragment>
                    Congratulations! Navigation tabs will help keep things organized if you start doing a lot with the application, and Knowledge will tell you about the specific world of this instance.
                    <br /><br />
                    But that's not the only way to learn about the world. Onboarding has more chapters to lead you through more of Make The World's features.
                </React.Fragment>,
                subItems: []
            }
        ]
    },
    {
        chapterKey: 'PlayCharacter',
        pages: [
            {
                pageKey: 'pageInCharacter',
                text: `You can also explore by taking on the role of a character in the world itself`,
                subItems: [
                    {
                        key: 'navigatePlay',
                        text: <React.Fragment>On the Home tab, select a character to play them in the virtual world.</React.Fragment>
                    }
                ]
            },
            {
                pageKey: 'pageLineEntryModes',
                text: 'Here you are, playing a role in the world alongside everybody else. You control your character, and "see" through their eyes. One of the ways you can make things happen is through the input field at the bottom of the page. Give it a try',
                subItems: [
                    {
                        key: 'commandMode',
                        text: <React.Fragment>Your input field (bottom) defaults to Command mode. Focus into that field, type 'look' and hit enter.</React.Fragment>
                    },
                    {
                        key: 'sayMode',
                        text: <React.Fragment>The input field has a mode selector (bottom right) with up and down arrows. Press the up arrow once (or press the " key) to enter Say mode, and type something for your character to say (like "Hi!")</React.Fragment>
                    },
                    {
                        key: 'narrateMode',
                        text: <React.Fragment>Press the up arrow twice (or press the : key) to enter Narrate mode, and type something that should be narrated happening in the room (like "Nathan looks around.")</React.Fragment>
                    },
                    {
                        key: 'OOCMode',
                        text: `Press the up arrow three times (or press the \\ key) to enter out-of-character mode, and type something that should be shared with other players nearby, outside the story (like "I'm new here")`
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
                        text: `On the left, below the description of the room, are exits to other places. Press one of those exits to leave this room and go to another.`
                    },
                    {
                        key: 'actionLink',
                        text: `Somewhere in the details of this room you will find highlights on something you could DO (like "ring the bell"). Press one of those highlights to take action in the world.`
                    }
                ]
            }
        ]
    },
    {
        chapterKey: 'CreateAsset',
        lock: 'endPlayCharacter',
        pages: [
            {
                pageKey: 'pageLibrary',
                text: `You're really getting how to play a role in the world. Plenty of people enjoy doing that alone (and if that's you, you can skip the rest of the onboarding). Others enjoy adding to the world as well. Explore the options for expanding the world`,
                subItems: [
                    {
                        key: 'navigateHomeInPlay',
                        text: `Use the navigation tabs to return to the Home page.`
                    },
                    {
                        key: 'navigateLibrary',
                        text: `Select the "Library" button in the "Create" section below.`
                    }
                ]
            },
            {
                pageKey: 'pageDraftAsset',
                text: `This is the Library in which Make The World organizes the Assets that make the game. Assets are layers of description on rooms, features, etc., that are laid on one another successively to create the final world. You can create Personal Assets whose content is seen only by you, to test out creations. Let's give it a try`,
                subItems: [
                    {
                        key: 'createAsset',
                        text: 'In the Personal section, below, click Add Asset.'
                    },
                    {
                        key: 'nameAsset',
                        text: 'Give the new Asset an unique name (this may take some trying ... the name must be globally unique) and click "Add"'
                    }
                ]
            },
            {
                pageKey: 'pageDraftRoom',
                text: `You have created a personal asset that you can make private changes in. The Asset Editor can be daunting, but you'll start small. Create a new room of your own invention to include in the world`,
                subItems: [
                    {
                        key: 'addRoom',
                        text: `In the Rooms subsection, below, click the Add Room button, and give the room an internal key.`
                    },
                    {
                        key: 'navigateRoom',
                        text: `Click the new (Untitled) room item to navigate to its detail editor.`
                    },
                    {
                        key: 'nameRoom',
                        text: 'Enter a name for the room.'
                    },
                    {
                        key: 'describeRoom',
                        text: 'Enter a description for the room.'
                    }
                ]
            },
            {
                pageKey: 'pageDraftImportRoom',
                text: `Now you can find a place already in the world, and attach your room nearby. The easiest way to do that is straight from the world itself. Give it a go`,
                subItems: [
                    {
                        key: 'navigatePlayWithAsset',
                        text: 'Use the Navigation tabs to go back to the page where you are playing a character.'
                    },
                    {
                        key: 'importRoom',
                        text: 'You will note that room descriptions now include an "Edit" button. Pick a room you want to expand the world from, and click the Edit button on that room.'
                    }
                ]
            },
            {
                pageKey: 'pageDraftExits',
                text: `You've told Make The World that your Personal Asset will not only create your new room, it will also add content to an already existing room. Now you can change that room to make it possible to travel from there to your new room`,
                subItems: [
                    {
                        key: 'navigateAssetWithImport',
                        text: `If needed, navigate back to the library and select the imported room to get to its detail editor.`
                    },
                    {
                        key: 'addExit',
                        text: `In the Exits section, click "Add Exit". Give the exit a descriptive name, and select the key of the room you created as a destination.`
                    },
                    {
                        key: 'addExitBack',
                        text: `Click enter in the exit name, and you should be given an identical exit. Click the "here" button in it to reverse it to point back from your created room to the room you imported. Give that a descriptive name as well.`
                    }
                ]
            },
            {
                pageKey: 'pageDraftSave',
                text: `You have a draft of a new creation for the shared world, now it's time to let the system know about it`,
                subItems: [
                    {
                        key: 'saveAsset',
                        text: `Close the detail editor and return to the main table-of-contents for your new Asset. Press the "Save" button at upper right to send your draft to the system.`
                    },
                    {
                        key: 'navigateLibraryAfterAsset',
                        text: `Select the main Library on the navigation tabs.`
                    }
                ]
            },
            {
                pageKey: 'pageDraftUpdateCharacter',
                subItems: [
                    {
                        key: 'editCharacter',
                        text: `Select the player you are playing with, and click the edit button the preview pane.`
                    },
                    {
                        key: 'editCharacterAssets',
                        text: 'Click the "Assets" field at bottom, and add your new asset to the selection to see for this character.'
                    },
                    {
                        key: 'saveCharacter',
                        text: `At upper right, click the "Save" button to save the change.`
                    }
                ]
            },
            {
                pageKey: 'pageDraftNavigate',
                text: `You've updated the system to know about your asset and to show it for your character. Time to go take a look`,
                subItems: [
                    {
                        key: 'navigatePlayWithPersonalRoom',
                        text: `Navigate back to your In-Play window. The new exit you created should be visible in the room you chose.`
                    },
                    {
                        key: 'navigatePersonalRoom',
                        text: 'Press that exit to travel to your new room.'
                    }
                ]
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
