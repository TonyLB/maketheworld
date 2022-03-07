//
// The AppLayout component handles high-level styling and positioning of data components within the app
//

/** @jsxImportSource @emotion/react */
import React from 'react'
import { css } from '@emotion/react'
import { useSelector } from 'react-redux'
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
    IconButton
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ForumIcon from '@mui/icons-material/Forum'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import HomeIcon from '@mui/icons-material/Home'

import ActiveCharacter from '../ActiveCharacter'
import InDevelopment from '../InDevelopment'
import ChoiceDialog from '../ChoiceDialog'

import MapHome from '../Maps'
import MapView from '../Maps/View'
import CharacterEdit from '../CharacterEdit'
import HelpPage from '../Help'

import { navigationTabs, navigationTabSelected } from '../../slices/UI/navigationTabs'


const a11yProps = (index) => {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    }
}

const tabList = ({ large, navigationTabs = [] }) => ([
    <Tab
        key="Home"
        label="Home"
        value="home"
        {...a11yProps(0)}
        icon={<HomeIcon />}
        component={Link}
        to="/"
    />,
    ...(navigationTabs.map(({ href, label }, index) => (
        <Tab
            key={href}
            label={label}
            value={href}
            {...a11yProps(index + 1)}
            icon={<ForumIcon />}
            component={Link}
            to={href}
        />
    ))),
    ...(large ? [] : [<Tab key="Who" label="Who is on" value="who" {...a11yProps(2+navigationTabs.length)} icon={<PeopleAltIcon />} to="/Who/" />])
])

const FeedbackSnackbar = ({ feedbackMessage, closeFeedback }) => {
    const handleClose = (_, reason) => {
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
            <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
                <CloseIcon fontSize="small" />
            </IconButton>
        }
    />

}

const CharacterMapRouter = () => {
    const { MapId } = useParams()
    return <MapView MapId={MapId} />
}

const CharacterRouterSwitch = ({ messagePanel }) => {
    const { CharacterId } = useParams()
    return <ActiveCharacter key={`Character-${CharacterId}`} CharacterId={CharacterId}>
        <Routes>
            <Route path={`Play`} element={messagePanel} />
            <Route path={`Map/:MapId/`} element={<CharacterMapRouter />} />
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
                allowScrollButtonsMobile>
                {tabList({ large, navigationTabs: navigationTabsData })}
            </Tabs>
        </Box>
    );
}

export const AppLayout = ({ whoPanel, homePanel, messagePanel, mapPanel, threadPanel, feedbackMessage, closeFeedback }) => {
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
                    overflow-y: hidden;
                `}
            >
                <Box sx={{ width: "100%", height: "100%" }}>
                    <Routes>
                        <Route path="/Character/Archived" element={<InDevelopment />} />
                        <Route path="/Character/Edit/:CharacterKey" element={<CharacterEdit />} />
                        <Route path="/Character/:CharacterId/*" element={<CharacterRouterSwitch messagePanel={messagePanel} />} />
                        <Route path="/Forum/" element={<InDevelopment />} />
                        <Route path="/Calendar/" element={<InDevelopment />} />
                        <Route path="/Scenes/" element={<InDevelopment />} />
                        <Route path="/Stories/" element={<InDevelopment />} />
                        <Route path="/Chat/" element={<InDevelopment />} />
                        <Route path="/Logs/" element={<InDevelopment />} />
                        <Route path="/Forum/" element={<InDevelopment />} />
                        <Route path="/Maps/*" element={<MapHome />} />
                        <Route path="/Help/" element={<HelpPage />} />
                        <Route path="/Who/" element={whoPanel} />
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