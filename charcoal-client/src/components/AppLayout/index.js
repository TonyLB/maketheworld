//
// The AppLayout component handles high-level styling and positioning of data components within the app
//

import React, { useState } from 'react'
import { useSelector } from 'react-redux'

import './index.css'

import useMediaQuery from '@material-ui/core/useMediaQuery'
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import Box from '@material-ui/core/Box'
import Snackbar from '@material-ui/core/Snackbar'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import { makeStyles } from '@material-ui/core/styles'
import ForumIcon from '@material-ui/icons/Forum'
import MailIcon from '@material-ui/icons/Mail'
import ExploreIcon from '@material-ui/icons/Explore'
import PeopleAltIcon from '@material-ui/icons/PeopleAlt'

import ActiveCharacter from '../ActiveCharacter'
import { getCharacters } from '../../selectors/characters'

const TabPanel = (props) => {
    const { children, value, index, ...other } = props

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            {...other}
        >
            <Box style={{ height: "100%" }}>
                {children}
            </Box>
        </div>
    )
}

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

const tabList = ({ large, subscribedCharacterIds = [], characters }) => ([
    <Tab key="Profile" label="Profile" value="profile" {...a11yProps(0)} icon={<PeopleAltIcon />} />,
    ...subscribedCharacterIds.reduce(
        (previous, characterId, index) => ([
            ...previous,
            <Tab key={`inPlay-${characterId}`} label={`Play: ${characters[characterId]?.Name}`} value={`inPlay-${characterId}`} {...a11yProps(1+(index*2))} icon={<ForumIcon />} />,
            <Tab key={`message-${characterId}`} label={`Chat: ${characters[characterId]?.Name}`} value={`messages-${characterId}`} {...a11yProps(2+(index*2))} icon={<MailIcon />} />
        ]), []),
    <Tab key="Map" label="Map" value="map" {...a11yProps(3+(subscribedCharacterIds.length*2))} icon={<ExploreIcon />} />,
    ...(large ? [] : [<Tab key="Who" label="Who is on" value="who" {...a11yProps(4+subscribedCharacterIds.length*2)} icon={<PeopleAltIcon />} />])
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

export const AppLayout = ({ whoPanel, profilePanel, messagePanel, mapPanel, threadPanel, feedbackMessage, closeFeedback, subscribedCharacterIds = [] }) => {
    const portrait = useMediaQuery('(orientation: portrait)')
    const large = useMediaQuery('(orientation: landscape) and (min-width: 1500px)')
    const [value, setValue] = useState('profile')
    const classes = useStyles()
    const characters = useSelector(getCharacters)

    const handleChange = (event, newValue) => {
        setValue(newValue);
    }

    return <div className={`fullScreen ${classes.grid}`}>
        <FeedbackSnackbar feedbackMessage={feedbackMessage} closeFeedback={closeFeedback} />
        <div className={classes.tabs}>
            <Tabs
                classes={{ vertical: 'tabRootVertical' }}
                orientation={portrait ? "horizontal" : "vertical"}
                variant="scrollable"
                scrollButtons="on"
                value={value}
                onChange={handleChange}
                aria-label="MakeTheWorld navigation"
                indicatorColor="primary"
                textColor="primary"
            >
                {tabList({ large, subscribedCharacterIds, characters })}
            </Tabs>
        </div>

        <div className={classes.content}>
            <TabPanel value={value} index={'profile'} style={{ width: "100%", height: "100%" }}>
                {profilePanel}
            </TabPanel>
            {
                subscribedCharacterIds.map((characterId) => (
                    <ActiveCharacter key={`Character-${characterId}`} CharacterId={characterId}>
                        <TabPanel value={value} index={`inPlay-${characterId}`} style={{ width: "100%", height: "100%" }}>
                            {messagePanel}
                        </TabPanel>
                    </ActiveCharacter>
                ))
            }
            {/* <TabPanel value={value} index={'messages'} style={{ width: "100%", height: "100%" }}>
                {threadPanel}
            </TabPanel>
            <TabPanel
                value={value}
                index={'map'}
                style={{ height: "100%" }}
            >
                {mapPanel}
            </TabPanel>
            <TabPanel value={value} index={'who'} style={{ height: "100%" }}>
                {whoPanel}
            </TabPanel> */}
        </div>

        {large
            ? <div className={classes.sidebar}>
                {/* {whoPanel} */}
            </div>
            : []
        }
    </div>

}

export default AppLayout