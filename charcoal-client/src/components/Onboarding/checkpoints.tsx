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
                        text: <React.Fragment>On the Home tab, under the "Play" section, select a character in order to play them in the virtual world.</React.Fragment>
                    }
                ]
            },
            {
                pageKey: 'pageLineEntryModes',
                text: 'Here you are, playing a role in the world alongside everybody else. You control your character, and "see" through their eyes. One of the ways you can make things happen is through the input field at the bottom of the page. Give it a try',
                subItems: [
                    {
                        key: 'commandMode',
                        text: <React.Fragment>Your input field (bottom) defaults to Command mode. Focus into that field, type 'look' and hit enter. As the Make The World software evolves, there will be many more possibilities in this mode, but today it's pretty sparse.</React.Fragment>
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
        lock: 'endPlayCharacter',
        pages: [
            {
                pageKey: 'pageCreateAssetIntro',
                text: `You're really getting how to play a role in the world. Plenty of people enjoy doing that alone (and if that's you, you can skip the rest of the onboarding). Others enjoy adding to the world as well. Let's talk about how Make The World supports collaborative storytelling and world-building.`,
                subItems: []
            },
            {
                pageKey: 'pageExplainAssets',
                text: <React.Fragment>
                    A little philosophy: Sharing stories within a community is complicated, for a lot of reasons. Think, for instance, about any popular, long-running, movie franchise: Some people will want to enjoy the main, famous, movies and not much
                    else. Others will dig in to the details of every movie. Some will read the novelizations, the extended universe (or whatever) and every official source. Others will dive into fan-fiction worlds and the spin-offs
                    that the fans create.
                    <br /><br />
                    The point here is that in a shared story-telling space, there isn't <em>one, uniquely authoritative</em> version of the world. Instead, there are at least as many viewpoints on the story as there are people to do the viewing.
                    Make The World supports that by organizing the data it stores into layers called "Assets". Each Asset can define a number of things about the world (rooms, features, knowledge, etc.) and can also refer to
                    things defined in earlier assets and extend them. Think of each asset a like layers in image-editing software (but for words): A given room, for instance, can have its basic description and exits to other rooms defined in a first
                    asset, but then get description and more exits (to other rooms) added onto it in a second asset. The world gets built up and made more complicated through successive layers.
                </React.Fragment>,
                subItems: []
            },
            {
                pageKey: 'pageExplainCanon',
                text: <React.Fragment>
                    The reason to build the world in layers is to support many viewpoints: Some Assets are considered "Canon", which means that the system automatically serves up that information to everyone. But other assets are not
                    canon, they are opt-in ... not everyone will see the changes in those assets, only those who have chosen to.
                    <br /><br />
                    Opting in to layers of the world is one of the fundamental ways that Make The World supports many outcomes that communities need. If you and a group of your friends want to go off and tell a wacky story of time-travel,
                    alternate worlds, and multiverse hijinks, you can do all of that without asking anyone for permission to completely rewrite the rules of reality ... you just do it in a set of assets that only your friends opt in on.
                    Other players might be confused about some of your conversations, but they're not going to have to deal with the mirror-universe impinging upon their own, different, stories.
                </React.Fragment>,
                subItems: []
            },
            {
                pageKey: 'pageExplainWorkshopping',
                text: <React.Fragment>
                    The other, really important, thing that layered Assets provides is a toolkit for players to start creating <em>bad first drafts</em> of their ideas, and then improve upon them. Everything that players create is first
                    stored as assets that only they can see. They work on those until they feel that they're ready to show them around, and then use Make The World's tools to invite people to make comments and suggestions, in a process
                    called "Workshopping" (code still being very-actively developed). Through workshopping an asset can go from private, to something available in the library, and even to being included in the canon.
                    <br /><br />
                    Workshopping serves several purposes:
                        <ul>
                            <li>
                                Some people (not you, you're awesome) are just jerks, and will turn a community storytelling tool toward deliberately offensive and hateful content. If the community doesn't have any way to defend itself,
                                those people will take over. It stinks, but it's true.
                            </li>
                            <li>
                                Even among people of good will, first drafts are mostly just awful. Getting those awful first drafts "on paper" is the only way to improve them, so it's vitally important that the system not encourage
                                writer's block by saying "Well, you need to prove your draft is at least yay-good before we put it into the system."
                            </li>
                            <li>
                                Even people of good will and miraculous ability are not mind-readers. To share a story with a community, you need to check in with that community, plain and simple.
                            </li>
                        </ul>
                </React.Fragment>,
                subItems: []
            },
            {
                pageKey: 'pageLibrary',
                text: `Okay, that was probably more than just a little philosophy. Let's explore your options for expanding the world`,
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
                text: `This is the Library in which Make The World organizes the Assets that make the game. You can create Personal Assets whose content is seen only by you, to test out creations. Let's give it a try`,
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
                pageKey: 'pageDraftNavigate',
                text: `You've updated the system to know about your asset. Time to go take a look in-character`,
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
            },
            {
                pageKey: 'pageCreateAssetCongratulations',
                text: `Congratulations! You've learned how to use Make The World to create new assets and extend the world. This is the basic tool that people use to generate the entire setting for shared stories.`,
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
