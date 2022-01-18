//
// The AppLayout component handles high-level styling and positioning of data components within the app
//

import React from 'react'
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

import useMediaQuery from '@material-ui/core/useMediaQuery'
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import Snackbar from '@material-ui/core/Snackbar'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import { makeStyles } from '@material-ui/core/styles'
import ForumIcon from '@material-ui/icons/Forum'
import PeopleAltIcon from '@material-ui/icons/PeopleAlt'
import HomeIcon from '@material-ui/icons/Home'

import ActiveCharacter from '../ActiveCharacter'
import InDevelopment from '../InDevelopment'
import ChoiceDialog from '../ChoiceDialog'

import MapHome from '../Maps'
import CharacterEdit from '../CharacterEdit'
import HelpPage from '../Help'

import { navigationTabs, navigationTabSelected } from '../../slices/UI/navigationTabs'


const a11yProps = (index) => {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    }
}

const useStyles = makeStyles((theme) => ({
    grid: {
        backgroundColor: theme.palette.background.paper,
        display: 'grid',
        justifyContent: "stretch",
        '@media (orientation: landscape)': {
            gridTemplateAreas: `
                "tabs content"
            `,
            gridTemplateColumns: "auto 1fr",
            gridTemplateRows: "1fr"
        },
        '@media (orientation: landscape) and (min-width: 1500px)': {
            gridTemplateAreas: `
                "tabs content sidebar"
            `,
            gridTemplateColumns: "auto 1fr 400px",
            gridTemplateRows: "1fr"
        },
        '@media (orientation: portrait)': {
            gridTemplateAreas: `
                "tabs"
                "content"
            `,
            gridTemplateRows: "auto 1fr",
            gridTemplateColumns: "100%"
        }
    },
    tabs: {
        gridArea: "tabs",
        overflow: "hidden"
    },
    tabRootHorizontal: {
        width: "100%"
    },
    content: {
        gridArea: "content",
        width: "100%",
        height: "100%",
        overflowY: "hidden"
    },
    sidebar: {
        gridArea: "sidebar",
        backgroundColor: theme.palette.primary,
        overflowY: "auto"
    }
}))

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
    ...(large ? [] : [<Tab key="Who" label="Who is on" value="who" {...a11yProps(2+navigationTabs.length)} icon={<PeopleAltIcon />} />])
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

const CharacterRouterSwitch = ({ messagePanel }) => {
    const { CharacterId } = useParams()
    return <ActiveCharacter key={`Character-${CharacterId}`} CharacterId={CharacterId}>
        <Routes>
            <Route path={`Play`} element={messagePanel} />
            <Route path={`Map`} element={<InDevelopment />} />
        </Routes>
    </ActiveCharacter>
}

const NavigationTabs = () => {
    const { pathname } = useLocation()
    const selectedTab = useSelector(navigationTabSelected(pathname))
    const navigationTabsData = useSelector(navigationTabs)
    const portrait = useMediaQuery('(orientation: portrait)')
    const classes = useStyles()
    const large = useMediaQuery('(orientation: landscape) and (min-width: 1500px)')
    return <div className={classes.tabs}>
        <Tabs
            classes={{ vertical: 'tabRootVertical' }}
            orientation={portrait ? "horizontal" : "vertical"}
            variant="scrollable"
            scrollButtons="on"
            value={selectedTab ? selectedTab.href : 'home'}
            aria-label="Navigation"
            indicatorColor="primary"
            textColor="primary"
        >
            {tabList({ large, navigationTabs: navigationTabsData })}
        </Tabs>
    </div>
}

export const AppLayout = ({ whoPanel, homePanel, messagePanel, mapPanel, threadPanel, feedbackMessage, closeFeedback }) => {
    const large = useMediaQuery('(orientation: landscape) and (min-width: 1500px)')
    const classes = useStyles()

    return <Router>
        <div className={`fullScreen ${classes.grid}`}>
            <ChoiceDialog />
            <FeedbackSnackbar feedbackMessage={feedbackMessage} closeFeedback={closeFeedback} />
            <NavigationTabs />
            <div className={classes.content}>
                <div style={{ width: "100%", height: "100%" }}>
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
                        <Route path="/" element={homePanel} />
                    </Routes>
                </div>
            </div>

            {large
                ? <div className={classes.sidebar}>
                    {whoPanel}
                </div>
                : []
            }
        </div>
    </Router>

}

export default AppLayout