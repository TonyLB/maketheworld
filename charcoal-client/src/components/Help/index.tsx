// Foundational imports (React, Redux, etc.)
import React, { useState, ReactChild } from 'react'

// MaterialUI imports
import {
    AppBar,
    Grid,
    Tabs,
    Tab,
    Typography,
    Box,
    Paper,
    Tooltip
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import HelpIcon from '@mui/icons-material/Help'
import SettingsIcon from '@mui/icons-material/Settings'

// Local code imports
import Map from '../../static/Map.png'
import useStyles from '../styles'

const a11yProps = (index: number) => ({
    id: `scrollable-auto-tab-${index}`,
    'aria-controls': `scrollable-auto-tabpanel-${index}`
})

type TabPanelProps = {
    value: number;
    index: number;
    children: ReactChild | ReactChild[];
}

const TabPanel = ({ value, index, children }: TabPanelProps) => (
    <Typography
        component="div"
        role="tabpanel"
        hidden={value !== index}
        id={`tabpanel-${index}`}
        aria-labelledby={`tab-${index}`}
    >
        {value === index && <Box p={3} style={{ width: "600px" }}>{children}</Box>}
    </Typography>
)

const CommandEntry = ({ label='', argument=false, explanation='' }) => (
    <React.Fragment>
        <Grid item xs={4}>
            <b>{label}</b>{argument ? <React.Fragment>&nbsp;<em>&lt;text&gt;</em></React.Fragment> : null}
        </Grid>
        <Grid item xs={8}>
            { explanation }
        </Grid>
    </React.Fragment>
)

//
// TODO: Refactor HelpPage to allow for more modular creation of content, and rewrite
// the help contents to reflect the updated state of the system.
//
export const HelpPage = () => {
    const classes = useStyles()
    const [tabValue, setTabValue] = useState(0)
    const handleChange = (event: any, newValue: number) => {
        setTabValue(newValue)
    }

    return(
        <React.Fragment>
            <AppBar position="static" color="default">
                <Tabs
                    value={tabValue}
                    onChange={handleChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                    aria-label="help tabs"
                    centered
                >
                    <Tab label="Controls" {...a11yProps(0)} />
                    <Tab label="Text Commands" {...a11yProps(1)} />
                    <Tab label="World organization" {...a11yProps(2)} />
                </Tabs>
            </AppBar>
            <TabPanel value={tabValue} index={0}>
                <Grid container spacing={2}>
                    <Grid item xs={3}>
                        <Tooltip
                            placement="bottom"
                            arrow
                            title={
                                <React.Fragment>
                                    This menu allows you to:
                                    <ul>
                                        <li>Edit rooms and neighborhoods</li>
                                    </ul>
                                </React.Fragment>
                            }
                        >
                            <Paper className={classes.roomMessage}>
                                <MenuIcon />
                            </Paper>
                        </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                        <Tooltip
                            placement="bottom"
                            arrow
                            title={
                                <React.Fragment>
                                    Things this display shows you:
                                    <ul>
                                        <li>The description of the room</li>
                                        <li>The exits out of the room to other places (over for a description, click to travel there)</li>
                                        <li>The active characters in the room (hover for a description)</li>
                                    </ul>
                                </React.Fragment>
                            }
                        >
                            <Paper className={classes.roomMessage}>
                                <Typography align="center">
                                    The room you are currently in
                                </Typography>
                            </Paper>
                        </Tooltip>
                    </Grid>
                    <Grid item xs={3}>
                        <Tooltip
                            placement="bottom"
                            arrow
                            title={
                                <React.Fragment>
                                    These menus allow you to:
                                    <ul>
                                        <li>Open this help dialog</li>
                                        <li>Set your character home</li>
                                        <li>Add and edit characters</li>
                                        <li>Sign out of the system</li>
                                    </ul>
                                </React.Fragment>
                            }
                        >
                            <Paper className={classes.roomMessage}>
                                <Typography align="right">
                                    <HelpIcon />
                                    <SettingsIcon />
                                </Typography>
                            </Paper>
                        </Tooltip>
                    </Grid>
                    <Grid item xs={3} />
                    <Grid item xs={6}>
                        <Tooltip
                            placement="right"
                            arrow
                            title={
                                <React.Fragment>
                                    Things this display shows you:
                                    <ul>
                                        <li>Things that have happened in your room</li>
                                        <li>Rooms and neighborhoods you enter</li>
                                        <li>A recap of what happened recently in rooms you enter (click the arrow to expand)</li>
                                        <li>Announcements</li>
                                        <li>Direct messages to and from you</li>
                                    </ul>
                                </React.Fragment>
                            }
                        >
                            <Paper style={{ height: "400px", display: "flex", justifyContent: "center", alignItems: "center" }} >
                                All the things that have happened around you
                            </Paper>
                        </Tooltip>
                    </Grid>
                    <Grid item xs={3}>
                        <Tooltip
                            placement="left"
                            arrow
                            title={
                                <React.Fragment>
                                    Things this display shows you:
                                    <ul>
                                        <li>Who is active on the game</li>
                                        <li>What neighborhood they are in</li>
                                    </ul>
                                    Click the arrow to open or close the drawer
                                    Click a character to send them a direct message
                                </React.Fragment>
                            }
                        >
                            <Paper style={{ height: "100%", width: "100%", display: "flex", justifyContent: "flex-end", alignItems: "center" }} >
                                <Typography align="right">
                                    Who is online
                                </Typography>
                            </Paper>
                        </Tooltip>
                    </Grid>
                    <Grid item xs={12}>
                        <Tooltip
                                placement="top"
                                arrow
                                title={
                                    <React.Fragment>
                                        Things this lets you do:
                                        <ul>
                                            <li>Enter text to appear in the discussion in your room</li>
                                            <li>Enter command shortcuts to do things in the game (like move)</li>
                                        </ul>
                                    </React.Fragment>
                                }
                            >
                            <Paper className={classes.roomMessage}>
                                <Typography align="center">
                                    Enter text here
                                </Typography>
                            </Paper>
                        </Tooltip>
                    </Grid>
                </Grid>
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
                <Typography variant="h4" gutterBottom>Free entry</Typography>
                <Typography gutterBottom>
                    The command line lets you enter any command that the system knows how to parse, including several important ones that
                    take virtually any entry and convey it as either something your character says or does, or something that just happens.
                </Typography>
                <Typography variant="h4" gutterBottom>Commands</Typography>
                <Typography gutterBottom>
                    You can click the question mark or press the up-arrow when entering text to get a list of commands you might be trying to
                    enter.  If you enter any of the following commands on the chat line, they will be interpreted in order to do things other
                    than just have the text show up in the stream of messages:
                </Typography>
                <Grid container spacing={2}>
                    <CommandEntry label={`"`} argument explanation={`Have your character say whatever you type after the '"' (e.g. 'George says "Hi there!"')`} />
                    <CommandEntry label={`:`} argument explanation={`Have your character do whatever you type after the ':' (e.g. 'Sydney brushes their hair back.')`} />
                    <CommandEntry label={`@`} argument explanation={`Directly post whatever you type after the '@' (e.g. 'The bookshelf teeters dangerously.')`} />
                    <CommandEntry label="<any exit name>" explanation="Take that exit, as if you clicked it in the room description at top." />
                    <CommandEntry label="look" explanation="Get a room description message in your message stream." />
                    <CommandEntry label="look" argument explanation="Get a description of a character in the room." />
                    <CommandEntry label="help" explanation="Open this help window." />
                    <CommandEntry label="home" explanation="Instantly go from wherever you are to your characters home room." />
                    <CommandEntry label="shout" argument explanation="Shouts your message to your room and any adjacent room." />
                    <CommandEntry label="announce" argument explanation="Posts an announcement of your text to every room in the smallest neighborhood you occupy." />
                </Grid>
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
            <Typography variant="h4" gutterBottom>Rooms</Typography>
                <Typography gutterBottom>
                    A room is any place that a scene can play out.  A room can be as small as a closet, or as vast as an entire desert, so long as everyone in a scene
                    can be there together at once interacting.  Create small, grounded rooms when you want people to be able to think just about their character's
                    actions.  Use bigger, more abstract, rooms when you want to give people freedom to say (for instance) "Now we find an oasis in this desert!"
                </Typography>
                <Typography variant="h4" gutterBottom>Neighborhoods</Typography>
                <Typography gutterBottom>
                    Rooms are organized into neighborhoods like nesting dolls:  A room is in a neighborhood, which can be in another neighborhood, and so on without
                    practical limit (although mostly it's just a couple of layers of nesting at most).  Neighborhoods help give players a sense of
                    the <em>overall</em> area they are in, even when a room narrows the focus to a particular place.  Example:
                </Typography>
                <img src={Map} alt="example map" />
                <Typography>
                    ... in the above, Star's room has exits to both Marco's house and the Audience Hall, even though Marco's house is on Earth, whereas the Audience Hall is
                    in Butterfly Castle neighborhood, which in turn is in the larger Mewni neighborhood.  When you go from Star's room (in the Earth neighborhood) to the
                    Audience Hall, the system will prompt you "Mewni:  A magical land of etc., etc.", and "Butterfly Castle:  A majestic edifice of etc., etc." before
                    describing the Audience Hall room itself.
                </Typography>
            </TabPanel>
        </React.Fragment>
    )
}

export default HelpPage