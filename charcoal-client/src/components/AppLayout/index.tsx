//
// The AppLayout component handles high-level styling and positioning of data components within the app
//

/** @jsxImportSource @emotion/react */
import React, { FunctionComponent, useCallback } from 'react'
import { css } from '@emotion/react'
import { useDispatch, useSelector } from 'react-redux'
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Link,
    useParams,
    useLocation
} from "react-router-dom"

import './index.css'

import useMediaQuery from '@mui/material/useMediaQuery'
import {
    Box,
    Tabs,
    Tab,
    Snackbar,
    IconButton,
    SnackbarCloseReason
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ForumIcon from '@mui/icons-material/Forum'
import MapIcon from '@mui/icons-material/Explore'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import HomeIcon from '@mui/icons-material/Home'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import LibraryIcon from '@mui/icons-material/ArtTrack'

import ActiveCharacter from '../ActiveCharacter'
import InDevelopment from '../InDevelopment'
import ChoiceDialog from '../ChoiceDialog'

import MapHome from '../Maps'
import MapView from '../Maps/View'
import CharacterEdit from '../CharacterEdit'
import HelpPage from '../Help'
import Library from '../Library'
import EditAsset from '../Library/Edit/EditAsset'

import { navigationTabs, navigationTabSelected, remove } from '../../slices/UI/navigationTabs'
import EditCharacter from '../Library/Edit/EditCharacter'
import Notifications from '../Notifications'
import NavigationContextProvider, { useNavigationContext } from './NavigationContext'

const a11yProps = (index: number) => {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    }
}

const IconDispatcher = ({ iconName = 'Forum' }) => {
    switch(iconName) {
        case 'Map':
            return <MapIcon />
        case 'Notifications':
            return <NotificationsActiveIcon />
        case 'Library':
            return <LibraryIcon />
        default:
            return <ForumIcon />
    }
}

const IconWrapper = ({ iconName = 'Forum', href, closable=true }: { iconName: string; href: string; closable: boolean }) => {
    const dispatch = useDispatch()
    const { selectedTab, previousTab } = useNavigationContext()
    const onClose = useCallback((event) => {
        event.stopPropagation()
        event.preventDefault()
        if (!selectedTab || selectedTab.href === href) {
            previousTab()
        }
        dispatch(remove(href))
    }, [dispatch, href, selectedTab, previousTab])
    return <Box sx={{ position: "relative", width: "100%" }}>
        <IconDispatcher iconName={iconName} />
        { closable && <IconButton
                sx={{ position: "absolute", top: "-0.75em", right: "-0.5em" }}
                onClick={onClose}
            >
                <CloseIcon />
            </IconButton>
        }
    </Box>
}

const tabList = ({ large, navigationTabs = [] }: { large: boolean; navigationTabs: any[] }) => ([
    <Tab
        key="Home"
        label="Home"
        value="home"
        {...a11yProps(0)}
        icon={<HomeIcon />}
        component={Link}
        to="/"
    />,
    ...(navigationTabs.map(({ href, label, iconName, closable }, index) => (
        <Tab
            key={href}
            label={label}
            value={href}
            {...a11yProps(index + 1)}
            icon={<IconWrapper iconName={iconName} href={href} closable={closable} />}
            component={Link}
            to={href}
        />
    ))),
    ...(large ? [] : [<Tab key="Who" label="Who is on" value="/Who/" {...a11yProps(2+navigationTabs.length)} icon={<PeopleAltIcon />} />])
])

type FeedbackSnackbarProps = {
    feedbackMessage: string;
    closeFeedback: () => void;
}

const FeedbackSnackbar: FunctionComponent<FeedbackSnackbarProps> = ({ feedbackMessage, closeFeedback }) => {
    const handleClose = (_?: any, reason?: SnackbarCloseReason) => {
        if (reason === 'clickaway') {
            return
        }

        closeFeedback()
    }
    return <Snackbar
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
        }}
        open={Boolean(feedbackMessage)}
        message={feedbackMessage}
        autoHideDuration={6000}
        onClose={handleClose}
        action={
            <IconButton size="small" aria-label="close" color="inherit" onClick={() => { handleClose() }}>
                <CloseIcon fontSize="small" />
            </IconButton>
        }
    />

}

const CharacterRouterSwitch = ({ messagePanel }: any) => {
    const { CharacterId } = useParams()
    return <ActiveCharacter key={`Character-${CharacterId}`} CharacterId={`CHARACTER#${CharacterId}`}>
        <Routes>
            <Route path={`Play`} element={messagePanel} />
            <Route path={`Map/`} element={<MapView />} />
        </Routes>
    </ActiveCharacter>
}

const NavigationTabs = () => {
    const { pathname } = useLocation()
    const selectedTab = useSelector(navigationTabSelected(pathname))
    const navigationTabsData = useSelector(navigationTabs)
    const portrait = useMediaQuery('(orientation: portrait)')
    const large = useMediaQuery('(orientation: landscape) and (min-width: 1500px)')
    return (
        <NavigationContextProvider>
            <Box
                css={css`
                    grid-area: tabs;
                    overflow: hidden;
                `}
            >
                <Tabs
                    classes={{ vertical: 'tabRootVertical' }}
                    orientation={portrait ? "horizontal" : "vertical"}
                    variant="scrollable"
                    scrollButtons
                    value={selectedTab ? selectedTab.href : 'home'}
                    aria-label="Navigation"
                    indicatorColor="primary"
                    textColor="primary"
                    allowScrollButtonsMobile
                >
                    { tabList({ large, navigationTabs: navigationTabsData }) }
                </Tabs>
            </Box>
        </NavigationContextProvider>
    );
}


export const AppLayout = ({ whoPanel, homePanel, messagePanel, mapPanel, threadPanel, feedbackMessage, closeFeedback }: any) => {
    const large = useMediaQuery('(orientation: landscape) and (min-width: 1500px)')

    return <Router>
        <Box css={css`
                height: 100vh;
                /*
                    In order to override mobile-platform's delivery of vh as device size rather than viewport size,
                    we need to override (where possible) 
                */
                height: calc(var(--vh, 1vh) * 100);
                width: 100vw;

                display: grid;
                justify-content: stretch;
                @media (orientation: landscape) {
                    grid-template-areas:
                        "tabs content";
                    grid-template-columns: auto 1fr;
                    grid-template-rows: 1fr;
                }
                @media (orientation: landscape) and (min-width: 1500px) {
                    grid-template-areas:
                        "tabs content sidebar";
                    grid-template-columns: auto 1fr 400px;
                    grid-template-rows: 1fr;
                }
                @media (orientation: portrait) {
                    grid-template-areas:
                        "tabs"
                        "content";
                    grid-template-rows: auto 1fr;
                    grid-template-columns: 100%;
                }
            `}
            sx={{ bgcolor: 'background.paper' }}
        >
            <ChoiceDialog />
            <FeedbackSnackbar feedbackMessage={feedbackMessage} closeFeedback={closeFeedback} />
            <NavigationTabs />
            <Box
                css={css`
                    grid-area: content;
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                `}
            >
                <Box sx={{ width: "100%", height: "100%" }}>
                    <Routes>
                        <Route path="/Character/Archived" element={<InDevelopment />} />
                        <Route path="/Character/Edit/:CharacterKey" element={<CharacterEdit />} />
                        <Route path="/Character/:CharacterId/*" element={<CharacterRouterSwitch messagePanel={messagePanel} />} />
                        <Route path="/Library/" element={<Library />} />
                        <Route path="/Library/Edit/Asset/:AssetId/*" element={<EditAsset />} />
                        <Route path="/Library/Edit/Character/:AssetId/*" element={<EditCharacter />} />
                        <Route path="/Maps/*" element={<MapHome />} />
                        <Route path="/Help/" element={<HelpPage />} />
                        <Route path="/Who/" element={whoPanel} />
                        <Route path="/Notifications/" element={<Notifications />} />
                        <Route path="/index.html" element={homePanel} />
                        <Route path="/" element={homePanel} />
                    </Routes>
                </Box>
            </Box>
            {large
                ? <Box
                    css={css`
                        grid-area: sidebar;
                        overflow-y: auto;
                    `}
                    sx={{ bgcolor: 'primary' }}
                >
                    {whoPanel}
                </Box>
                : []
            }
        </Box>
    </Router>

}

export default AppLayout