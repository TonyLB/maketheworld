// Foundational imports (React, Redux, etc.)
import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// MaterialUI imports
import {
    Container,
    Paper,
    Backdrop,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    Card,
    CardHeader,
    CardContent,
    Button,
    TextField,
    Typography,
    List,
    ListItem,
    ListItemText,
    Divider,
    AppBar,
    Toolbar,
    IconButton,
    Menu,
    MenuItem
} from '@material-ui/core'
import MenuIcon from '@material-ui/icons/Menu'

// Local code imports
import { WSS_ADDRESS } from '../config'
import { receiveMessage, sendMessage } from '../actions/messages.js'
import { setName, registerName } from '../actions/name.js'
import { registerWebSocket } from '../actions/webSocket.js'
import { fetchAndOpenWorldDialog } from '../actions/permanentAdmin'
import { getMessages, getMostRecentRoomMessage } from '../selectors/messages.js'
import { getWebSocket } from '../selectors/webSocket.js'
import { getName } from '../selectors/name.js'
import { fetchCharacters } from '../actions/characters.js'
import { getCharacterFetchNeeded, getCharacters } from '../selectors/characters.js'
import LineEntry from '../components/LineEntry.js'
import Message from './Message'
import RoomDescriptionMessage from './Message/RoomDescriptionMessage'
import useStyles from './styles'
import RoomDialog from './RoomDialog/'
import WorldDialog from './WorldDialog/'

const CharacterPicker = ({ open, onClose = () => {} }) => {
    const characters = useSelector(getCharacters)
    // const handleClose = onClose(characterId)
    const classes = useStyles()

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
                    { (characters || []).map(({ Name: name }) => (<ListItem key={name} button>
                            <ListItemText>
                                {name}
                            </ListItemText>
                        </ListItem>
                    ))}
                    <Divider />
                    <ListItem button>
                        <ListItemText>
                            <Typography variant="">
                                <em>Create a new character</em>
                            </Typography>
                        </ListItemText>
                    </ListItem>
                </List>
            </DialogContent>
        </Dialog>
    )
}

export const Chat = () => {
    const webSocket = useSelector(getWebSocket)
    const messages = useSelector(getMessages)
    const mostRecentRoomMessage = useSelector(getMostRecentRoomMessage)
    const name = useSelector(getName)

    const dispatch = useDispatch()

    const classes = useStyles()

    const [ anchorEl, setAnchorEl ] = useState(null)
    const menuOpen = Boolean(anchorEl)
    const handleMenuClose = () => { setAnchorEl(null) }
    const handleMenuOpen = (event) => { setAnchorEl(event.currentTarget) }
    const handleWorldOverview = () => {
        dispatch(fetchAndOpenWorldDialog())
        handleMenuClose()
    }

    useEffect(() => {
        if (!webSocket) {
          let setupSocket = new WebSocket(WSS_ADDRESS)
          setupSocket.onopen = () => {
            console.log('WebSocket Client Connected')
            dispatch(registerName())
          }
          setupSocket.onmessage = (message) => {
            const { type, ...rest } = JSON.parse(message.data)
            switch(type) {
                case 'sendmessage':
                    dispatch(receiveMessage(rest))
                    break
                case 'registername':
                    dispatch(setName(rest.name))
                    break
                default:
            }
          }
          setupSocket.onerror = (error) => {
              console.error('WebSocket error: ', error)
          }
          dispatch(registerWebSocket(setupSocket))
        }
    }, [webSocket, dispatch])

    const characterFetchNeeded = useSelector(getCharacterFetchNeeded)
    useEffect(() => {
        if (characterFetchNeeded) {
            dispatch(fetchCharacters())
        }
    }, [characterFetchNeeded, dispatch])

    return (
        <React.Fragment>
            <AppBar position="fixed" color="primary" className={classes.topAppBar}>
                {
                    mostRecentRoomMessage && <Container maxWidth="lg">
                         <List>
                            <RoomDescriptionMessage key={`RoomMessage`} mostRecent message={mostRecentRoomMessage} />
                        </List>
                    </Container>
                }
            </AppBar>
            <Container className={classes.messageContainer} maxWidth="lg">
                <Paper className={classes.messagePaper}>
                    <List className={classes.messageList}>
                        {
                            messages.map((message, index) => (
                                <Message
                                    key={`Message-${index}`}
                                    { ...( message === mostRecentRoomMessage ? { mostRecent: true } : {})}
                                    message={message}
                                />
                            ))
                        }
                    </List>
                </Paper>
            </Container>
            <AppBar position="fixed" color="primary" className={classes.bottomAppBar}>
                <Container className={classes.container} maxWidth="lg">
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="open drawer"
                            onClick={handleMenuOpen}
                        >
                            <MenuIcon />
                        </IconButton>
                        <LineEntry
                            className={classes.lineEntry}
                            callback={ (entry) => { dispatch(sendMessage(entry)) }}
                        />
                        <Menu
                            open={menuOpen}
                            anchorEl={anchorEl}
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'left',
                              }}
                              keepMounted
                              transformOrigin={{
                                vertical: 'bottom',
                                horizontal: 'left',
                              }}
                              onClose={handleMenuClose}
                        >
                            <MenuItem onClick={handleWorldOverview}>
                                World Overview
                            </MenuItem>
                        </Menu>
                    </Toolbar>
                </Container>
            </AppBar>
            <WorldDialog />
            <RoomDialog />
            <CharacterPicker
                open={!name}
                // onClose={(name) => () => {
                //     dispatch(setName(name))
                // }}
            />
            <Backdrop open={(name && !webSocket) ? true : false}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </React.Fragment>
    );
  }

export default Chat
