//
// The AppLayout component handles high-level styling and positioning of data components within the app
//

import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link,
    useRouteMatch,
    useParams
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
import MailIcon from '@material-ui/icons/Mail'
import ExploreIcon from '@material-ui/icons/Explore'
import PeopleAltIcon from '@material-ui/icons/PeopleAlt'
import HomeIcon from '@material-ui/icons/Home'

import ActiveCharacter from '../ActiveCharacter'
import { getCharacters } from '../../selectors/characters'
import InDevelopment from '../InDevelopment'
import { navigationTabs } from '../../selectors/navigationTabs'

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

const tabList = ({ large, navigationTabs = [], subscribedCharacterIds = [], characters }) => ([
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
    // ...subscribedCharacterIds.reduce(
    //     (previous, characterId, index) => ([
    //         ...previous,
    //         <Tab
    //             key={`inPlay-${characterId}`}
    //             label={`Play: ${characters[characterId]?.Name}`}
    //             value={`inPlay-${characterId}`}
    //             {...a11yProps(1+(index*2))}
    //             icon={<ForumIcon />}
    //             component={Link}
    //             to={`/Character/${characterId}/Play`}
    //         />,
    //         <Tab key={`message-${characterId}`} label={`Chat: ${characters[characterId]?.Name}`} value={`messages-${characterId}`} {...a11yProps(2+(index*2))} icon={<MailIcon />} />
    //     ]), []),
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
    let { path } = useRouteMatch()
    return <ActiveCharacter key={`Character-${CharacterId}`} CharacterId={CharacterId}>
        <Switch>
            <Route path={`${path}/Play`}>
                {messagePanel}
            </Route>
            <Route path={`${path}/Map`}>
                <InDevelopment />
            </Route>
        </Switch>
    </ActiveCharacter>
}

export const AppLayout = ({ whoPanel, homePanel, profilePanel, messagePanel, mapPanel, threadPanel, feedbackMessage, closeFeedback, subscribedCharacterIds = [] }) => {
    const navigationTabsData = useSelector(navigationTabs)
    const portrait = useMediaQuery('(orientation: portrait)')
    const large = useMediaQuery('(orientation: landscape) and (min-width: 1500px)')
    const [value, setValue] = useState('home')
    const classes = useStyles()
    const characters = useSelector(getCharacters)

    const handleChange = (event, newValue) => {
        setValue(newValue);
    }

    return <Router>
        <div className={`fullScreen ${classes.grid}`}>
            <FeedbackSnackbar feedbackMessage={feedbackMessage} closeFeedback={closeFeedback} />
            <div className={classes.tabs}>
                <Tabs
                    classes={{ vertical: 'tabRootVertical' }}
                    orientation={portrait ? "horizontal" : "vertical"}
                    variant="scrollable"
                    scrollButtons="on"
                    value={value}
                    onChange={handleChange}
                    aria-label="Navigation"
                    indicatorColor="primary"
                    textColor="primary"
                >
                    {tabList({ large, navigationTabs: navigationTabsData, subscribedCharacterIds, characters })}
                </Tabs>
            </div>

            <div className={classes.content}>
                <div style={{ width: "100%", height: "100%" }}>
                    <Switch>
                        <Route path="/Character/Archived">
                            <InDevelopment />
                        </Route>
                        <Route path="/Character/:CharacterId">
                            <CharacterRouterSwitch messagePanel={messagePanel} />
                        </Route>
                        <Route path="/Forum/">
                            <InDevelopment />
                        </Route>
                        <Route path="/Calendar/">
                            <InDevelopment />
                        </Route>
                        <Route path="/Scenes/">
                            <InDevelopment />
                        </Route>
                        <Route path="/Stories/">
                            <InDevelopment />
                        </Route>
                        <Route path="/Chat/">
                            <InDevelopment />
                        </Route>
                        <Route path="/Logs/">
                            <InDevelopment />
                        </Route>
                        <Route path="/CodeOfConduct/">
                            <InDevelopment />
                        </Route>
                        <Route path="/Maps/">
                            <InDevelopment />
                        </Route>
                        <Route path="/">
                            {homePanel}
                        </Route>
                    </Switch>
                </div>
            </div>

            {large
                ? <div className={classes.sidebar}>
                    {/* {whoPanel} */}
                </div>
                : []
            }
        </div>
    </Router>

}

export default AppLayout