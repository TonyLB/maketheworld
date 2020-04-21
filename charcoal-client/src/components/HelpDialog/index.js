// Foundational imports (React, Redux, etc.)
import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    AppBar,
    Grid,
    Tabs,
    Tab,
    Typography,
    Box,
    Paper,
    Tooltip
} from '@material-ui/core'


// Local code imports
import Map from '../../static/Map.png'
import { closeHelpDialog } from '../../actions/UI/helpDialog'
import { getHelpDialogUI } from '../../selectors/UI/helpDialog.js'
import useStyles from '../styles'

const a11yProps = (index) => ({
    id: `scrollable-auto-tab-${index}`,
    'aria-controls': `scrollable-auto-tabpanel-${index}`
})

const TabPanel = ({ value, index, children, ...other }) => (
    <Typography
        component="div"
        role="tabpanel"
        hidden={value !== index}
        id={`tabpanel-${index}`}
        aria-labelledby={`tab-${index}`}
        {...other}
    >
        {value === index && <Box p={3} style={{ width: "600px" }}>{children}</Box>}
    </Typography>
)

const CommandEntry = ({ label='', argument=false, explanation='' }) => (
    <React.Fragment>
        <Grid item xs={4}>
            <b>{label}</b>{argument ? <React.Fragment>&nbsp;<em>&lt;text&gt;</em></React.Fragment> : null}:
        </Grid>
        <Grid item xs={8}>
            { explanation }
        </Grid>
    </React.Fragment>
)

export const HelpDialog = () => {
    const open = useSelector(getHelpDialogUI)
    const dispatch = useDispatch()
    const classes = useStyles()
    const [tabValue, setTabValue] = useState(0)
    const handleChange = (event, newValue) => {
        setTabValue(newValue)
    }

    const closeHandler = () => { dispatch(closeHelpDialog()) }
    return(
        <Dialog
            maxWidth="lg"
            open={open}
            onClose={closeHandler}
        >
            <DialogTitle id="help-dialog-title" className={classes.lightblue}>Help</DialogTitle>
            <DialogContent>
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
                        <Grid item xs={12}>
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
                        <Grid item xs={8}>
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
                        <Grid item xs={4}>
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
                        <Grid item xs={2}>
                            <Tooltip
                                placement="top-start"
                                arrow
                                title={
                                    <React.Fragment>
                                        Things this menu allows you to do:
                                        <ul>
                                            <li>Update your characters</li>
                                            <li>Set your character home</li>
                                            <li>Update and organize rooms and neighborhoods you have creative authority over</li>
                                            <li>Access this help message</li>
                                        </ul>
                                    </React.Fragment>
                                }
                            >
                                <Paper className={classes.roomMessage}>
                                    <Typography align="center">
                                        Menu
                                    </Typography>
                                </Paper>
                            </Tooltip>
                        </Grid>
                        <Grid item xs={10}>
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
                        If you just type some text then it will appear as a message with your character's name in the room the character occupies actions
                        that moment (just like a normal chat program).  The only exceptions are some specific commands that can be used from the entry line
                        for ease of access.
                    </Typography>
                    <Typography variant="h4" gutterBottom>Commands</Typography>
                    <Typography gutterBottom>
                        You can click the question mark or press the up-arrow when entering text to get a list of commands you might be trying to
                        enter.  If you enter any of the following commands on the chat line, they will be interpreted in order to do things other
                        than just have the text show up in the stream of messages:
                    </Typography>
                    <Grid container spacing={2}>
                        <CommandEntry label="<any exit name>" explanation="Take that exit, as if you clicked it in the room description at top." />
                        <CommandEntry label="look" explanation="Get a room description message in your message stream." />
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
            </DialogContent>
            <DialogActions>
                <Button onClick={closeHandler}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default HelpDialog