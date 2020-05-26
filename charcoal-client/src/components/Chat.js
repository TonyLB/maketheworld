// Foundational imports (React, Redux, etc.)
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// Amplify imports
import { Auth } from 'aws-amplify'

// MaterialUI imports
import {
    Container,
    Paper,
    Backdrop,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    List,
    ListItem,
    ListItemText,
    Divider,
    AppBar,
    Toolbar,
    IconButton,
    Menu,
    MenuItem,
    Snackbar,
    Fab
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import MenuIcon from '@material-ui/icons/Menu'
import HelpIcon from '@material-ui/icons/Help'
import SettingsIcon from '@material-ui/icons/Settings'
import NewMessagesIcon from '@material-ui/icons/FiberNew'

// Local code imports
import { WSS_ADDRESS } from '../config'
import { parseCommand } from '../actions/behaviors'
import { connectionRegister } from '../actions/connection.js'
import { setCurrentCharacterHome } from '../actions/characters'
import { registerCharacter } from '../actions/registeredCharacter.js'
import { registerWebSocket } from '../actions/webSocket.js'
import { fetchAndOpenWorldDialog } from '../actions/permanentAdmin'
import { activateMyCharacterDialog } from '../actions/UI/myCharacterDialog'
import { activateHelpDialog } from '../actions/UI/helpDialog'
import { activateConfirmDialog } from '../actions/UI/confirmDialog'
import { activateMapDialog } from '../actions/UI/mapDialog'
import { putPlayer } from '../actions/player'
import { getCurrentRoom, getVisibleExits } from '../selectors/currentRoom'
import { getMessages, getMostRecentRoomMessage } from '../selectors/messages.js'
import { getWebSocket } from '../selectors/webSocket.js'
import { getCharacterId } from '../selectors/connection'
import { getMyCharacters } from '../selectors/myCharacters'
import { getActiveCharactersInRoom } from '../selectors/charactersInPlay'
import { getConsentGiven, getPlayerFetched } from '../selectors/player'
import LineEntry from '../components/LineEntry.js'
import Message from './Message'
import RoomDescriptionMessage from './Message/RoomDescriptionMessage'
import useStyles from './styles'
import RoomDialog from './RoomDialog/'
import AllCharactersDialog from './AllCharactersDialog'
import WorldDialog from './WorldDialog/'
import MyCharacterDialog from './MyCharacterDialog'
import ConfirmDialog from './ConfirmDialog'
import HelpDialog from './HelpDialog'
import DirectMessageDialog from './DirectMessageDialog'
import MapDialog from './Map/'
import WhoDrawer from './WhoDrawer'
import MapDrawer from './MapDrawer'
import CodeOfConductConsentDialog from './CodeOfConductConsent'
import { activateAllCharactersDialog } from '../actions/UI/allCharactersDialog'
import useAppSyncSubscriptions from './useAppSyncSubscriptions'
import { roomDescription } from '../store/messages'

const CharacterPicker = ({ open, onClose = () => {} }) => {
    const myCharacters = useSelector(getMyCharacters)
    const handleClose = ({ name, characterId }) => (onClose({ name, characterId }))
    const classes = useStyles()
    const dispatch = useDispatch()

    return(
        <Dialog
            maxWidth="lg"
            open={open}
        >
            <DialogTitle
                id="room-dialog-title"
                className={classes.lightblue}
            >
                <Typography variant="overline">
                    Choose Your Character
                </Typography>
            </DialogTitle>
            <DialogContent>
                <List component="nav" aria-label="choose a character">
                    { (myCharacters || []).map(({ Name: name, CharacterId: characterId }) => (
                        <ListItem key={name} button onClick={handleClose({ name, characterId })}>
                            <ListItemText>
                                {name}
                            </ListItemText>
                        </ListItem>
                    ))}
                    <Divider />
                    <ListItem button onClick={ () => { dispatch(activateMyCharacterDialog({})) } }>
                        <ListItemText>
                            <em>Create a new character</em>
                        </ListItemText>
                    </ListItem>
                </List>
            </DialogContent>
        </Dialog>
    )
}

export const Chat = () => {
    useAppSyncSubscriptions()
    const webSocket = useSelector(getWebSocket)
    const messages = useSelector(getMessages)
    const mostRecentRoomMessage = useSelector(getMostRecentRoomMessage)
    const currentRoomAllExits = useSelector(getCurrentRoom)
    const visibleExits = useSelector(getVisibleExits) || []
    const currentRoom = {
        ...currentRoomAllExits,
        Exits: visibleExits
    }
    const characterId = useSelector(getCharacterId)
    const consentGiven = useSelector(getConsentGiven)
    const playerFetched = useSelector(getPlayerFetched)
    const Players = useSelector(getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId, myCharacterId: characterId }))

    const dispatch = useDispatch()

    const classes = useStyles()

    const [ menuAnchorEl, setMenuAnchorEl ] = useState(null)
    const menuOpen = Boolean(menuAnchorEl)
    const handleMenuClose = () => { setMenuAnchorEl(null) }
    const handleMenuOpen = (event) => { setMenuAnchorEl(event.currentTarget) }

    const [ settingsAnchorEl, setSettingsAnchorEl ] = useState(null)
    const settingsOpen = Boolean(settingsAnchorEl)
    const handleSettingsClose = () => { setSettingsAnchorEl(null) }
    const handleSettingsOpen = (event) => { setSettingsAnchorEl(event.currentTarget) }

    const [ errorOpen, setErrorOpen ] = useState(false)

    const handleCharacterOverview = () => {
        dispatch(activateAllCharactersDialog())
        handleSettingsClose()
    }
    const handleWorldOverview = () => {
        dispatch(fetchAndOpenWorldDialog())
        handleMenuClose()
    }
    const handleMapOverview = () => {
        dispatch(activateMapDialog())
        handleMenuClose()
    }
    const handleSetCharacterHome = () => {
        dispatch(setCurrentCharacterHome(currentRoom && currentRoom.PermanentId))
        handleSettingsClose()
    }
    const handleHelpDialog = () => {
        dispatch(activateHelpDialog())
    }
    const handleSignout = () => {
        dispatch(activateConfirmDialog({
            title: 'Sign Out',
            content: `Are you sure you want to sign out?`,
            resolveButtonTitle: 'Sign out',
            resolve: () => {
                Auth.signOut()
            }
        }))
        handleSettingsClose()
    }

    useEffect(() => {
        if (!webSocket) {
          let setupSocket = new WebSocket(WSS_ADDRESS)
          setupSocket.onopen = () => {
            console.log('WebSocket Client Connected')
          }
          setupSocket.onmessage = (message) => {
            const { type, ...rest } = JSON.parse(message.data)
            switch(type) {
                case 'connectionregister':
                    dispatch(connectionRegister(rest))
                    break
                //
                // No processing when a pong message (the response to a ping)
                // comes through.
                //
                default:
            }
          }
          setupSocket.onerror = (error) => {
              console.error('WebSocket error: ', error)
          }
          dispatch(registerWebSocket(setupSocket))
        }
    }, [webSocket, dispatch])

    const [ { lockToBottom, lastMessageId }, setScrolling ] = useState({ lockToBottom: true })
    const scrollRef = useRef(null)
    const lastMessageRef = useRef(null)
    const newLastMessageId = messages.length

    const scrollHeight = (scrollRef.current && scrollRef.current.scrollHeight) || 0
    const clientHeight = (scrollRef.current && scrollRef.current.clientHeight) || 0
    useEffect(() => {
        if (lockToBottom && lastMessageRef.current) {
            console.log('AutoScrolling')
            lastMessageRef.current.scrollIntoView()
        }
    }, [lockToBottom, scrollHeight, clientHeight, lastMessageId, newLastMessageId])

    const [whoDrawerOpen, setWhoDrawerOpen] = useState(false)
    const [mapDrawerOpen, setMapDrawerOpen] = useState(false)

    return (
        <React.Fragment>
        <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
            <AppBar position="relative" color="primary" className={classes.topAppBar}>
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu icon"
                        onClick={handleMenuOpen}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Container maxWidth="lg">
                        {
                            currentRoom && <List>
                                <RoomDescriptionMessage key={`RoomMessage`} mostRecent message={new roomDescription({
                                        ...currentRoom,
                                        Players,
                                        Recap: []
                                    })}
                                />
                            </List>
                        }
                    </Container>
                    <IconButton
                        edge="end"
                        color="inherit"
                        aria-label="help icon"
                        onClick={handleHelpDialog}
                    >
                        <HelpIcon />
                    </IconButton>
                    <IconButton
                        edge="end"
                        color="inherit"
                        aria-label="settings icon"
                        onClick={handleSettingsOpen}
                    >
                        <SettingsIcon />
                    </IconButton>
                    <Menu
                        open={menuOpen}
                        anchorEl={menuAnchorEl}
                        getContentAnchorEl={null}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                        onClose={handleMenuClose}
                    >
                        <MenuItem onClick={handleWorldOverview}>
                            Place Edit
                        </MenuItem>
                        <MenuItem onClick={handleMapOverview}>
                            Map Edit
                        </MenuItem>
                    </Menu>
                    <Menu
                        open={settingsOpen}
                        anchorEl={settingsAnchorEl}
                        getContentAnchorEl={null}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        onClose={handleSettingsClose}
                    >
                        <MenuItem onClick={handleSetCharacterHome}>
                            Set home to here
                        </MenuItem>
                        <MenuItem onClick={handleCharacterOverview}>
                            My Characters
                        </MenuItem>
                        <MenuItem onClick={handleSignout}>
                            Sign Out
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>
            <div style={{ position: "relative", height: "100%", width: "100%", overflowY: "hidden" }}>
                <div style={{ height: "100%", pointerEvents: "none" }}/>
                <div style={{ display: "flex", flexDirection: "row", position: "absolute", width: "100%", top: "0", left: "0", height: "100%" }}>
                    <Container className={classes.messageContainer}  maxWidth="lg">
                        <div className={classes.messageBottomSnapper}>
                            <Paper
                                ref={scrollRef}
                                className={classes.messagePaper}
                                onScroll={({ target }) => {
                                    console.log('OnScroll')
                                    if (target.scrollTop + target.clientHeight + 10 >= target.scrollHeight ) {
                                        setScrolling({ lockToBottom: true, lastMessageId })
                                    }
                                    else {
                                        setScrolling({ lockToBottom: false, lastMessageId })
                                    }
                                }}
                            >
                                <List className={classes.messageList}>
                                    {
                                        messages.slice(0, -1).map((message, index) => (
                                            <Message
                                                key={`Message-${index}`}
                                                { ...( message === mostRecentRoomMessage ? { mostRecent: true } : {})}
                                                message={message}
                                            />
                                        ))
                                    }
                                    {
                                        messages.slice(-1).map((message) => (
                                            <Message
                                                key={`Message-${messages.length - 1}`}
                                                ref={lastMessageRef}
                                                { ...( message === mostRecentRoomMessage ? { mostRecent: true } : {})}
                                                message={message}
                                            />
                                        ))
                                    }
                                    {
                                        messages.length === 0 &&
                                            <li ref={lastMessageRef}></li>
                                    }
                                </List>
                            </Paper>
                        </div>
                    </Container>
                </div>
                <div style={{ display: "flex", flexDirection: "row", position: "absolute", width: "100%", bottom: "0", left: "0" }}>
                    <div style={{ width: "50%" }} />
                    { (!lockToBottom) &&
                        <Fab
                            color="secondary"
                            className={classes.messageScrollButtonPlacement}
                            onClick={() => {
                                setScrolling({ lockToBottom: true, lastMessageId })
                            }}
                        >
                            <NewMessagesIcon />
                        </Fab>
                    }
                    <div style={{ width: "50%" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "row", position: "absolute", width: "100%", top: "0", left: "0", height: "100%", pointerEvents: "none" }}>
                    <MapDrawer open={mapDrawerOpen} toggleOpen={() => { setMapDrawerOpen(!mapDrawerOpen) }} />
                    <div style={{ width: "100%" }}/>
                </div>
                <div style={{ display: "flex", flexDirection: "row", position: "absolute", width: "100%", top: "0", left: "0", height: "100%", pointerEvents: "none" }}>
                    <div style={{ width: "100%" }}/>
                    <WhoDrawer open={whoDrawerOpen} toggleOpen={() => { setWhoDrawerOpen(!whoDrawerOpen) }} />
                </div>
            </div>

            <AppBar position="relative" color="primary" className={classes.bottomAppBar}>
                <Container className={classes.container} maxWidth="lg">
                    <Toolbar>
                        <LineEntry
                            className={classes.lineEntry}
                            callback={ (entry) => { return dispatch(parseCommand({ entry, raiseError: () => { setErrorOpen(true) }})) }}
                        />
                    </Toolbar>
                </Container>
            </AppBar>

            <DirectMessageDialog />
            <HelpDialog />
            <ConfirmDialog />
            <AllCharactersDialog />
            <WorldDialog />
            <MapDialog />
            <RoomDialog />
            <MyCharacterDialog />
            <CodeOfConductConsentDialog
                open={playerFetched && !consentGiven}
                onConsent={() => {
                    dispatch(putPlayer({ CodeOfConductConsent: true }))
                }}
            />
            <CharacterPicker
                open={(consentGiven && !characterId) || false}
                onClose={({ name, characterId }) => () => {
                    dispatch(registerCharacter({ name, characterId }))
                }}
            />
            <Backdrop open={((characterId && !webSocket) || !playerFetched) ? true : false}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </div>
        <Snackbar open={errorOpen}
            autoHideDuration={3000}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            onClose={() => setErrorOpen(false)}
        >
            <Alert onClose={() => setErrorOpen(false)} severity="error">
                The system cannot parse your command!
            </Alert>
        </Snackbar>

        </React.Fragment>
    );
  }

export default Chat
