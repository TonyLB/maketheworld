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
    DialogActions,
    Button,
    TextField,
    List,
    AppBar,
    Toolbar,
    IconButton
} from '@material-ui/core'
import MenuIcon from '@material-ui/icons/Menu'

// Local code imports
import { receiveMessage, sendMessage } from '../actions/messages.js'
import { setName, registerName } from '../actions/name.js'
import { registerWebSocket } from '../actions/webSocket.js'
import { getMessages, getMostRecentRoomMessage } from '../selectors/messages.js'
import { getWebSocket } from '../selectors/webSocket.js'
import { getName } from '../selectors/name.js'
import LineEntry from '../components/LineEntry.js'
import Message from './Message'
import RoomDescriptionMessage from './Message/RoomDescriptionMessage'
import useStyles from './styles'
import RoomDialog from './RoomDialog'

const NameDialog = ({ defaultValue, open, onClose = () => {} }) => {
    const [ localName, setLocalName ] = useState(defaultValue)
    const handleClose = onClose(localName)

    return(
        <Dialog maxWidth="lg" onClose={handleClose} open={open} >
            <DialogTitle id="name-dialog-title">Choose a Name</DialogTitle>
            <DialogContent>
                <TextField
                    fullWidth
                    placeholder='Enter your name here'
                    onChange={(e) => setLocalName(e.target.value)}
                    value={localName}
                />
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={handleClose} color="primary">
                    Save
                </Button>
            </DialogActions>
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

    useEffect(() => {
        if (name && !webSocket) {
          let setupSocket = new WebSocket('>INSERT WSS ADDRESS<')
          setupSocket.onopen = () => {
            console.log('WebSocket Client Connected')
            dispatch(registerName(name))
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
    }, [webSocket, name, dispatch])

    const [roomDialogOpen, setRoomDialogOpen] = useState(false)
    return (
        <React.Fragment>
            <AppBar position="fixed" color="primary" className={classes.topAppBar}>
                {
                    mostRecentRoomMessage && <Container maxWidth="lg">
                         <List>
                            <RoomDescriptionMessage key={`RoomMessage`} message={mostRecentRoomMessage} />
                        </List>
                    </Container>
                }
            </AppBar>
            <Container className={classes.messageContainer} maxWidth="lg">
                <Paper className={classes.messagePaper}>
                    <List className={classes.messageList}>
                        {
                            messages.map((message, index) => (
                                <Message key={`Message-${index}`} message={message} />
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
                            onClick={ () => { setRoomDialogOpen(!roomDialogOpen) } }
                        >
                            <MenuIcon />
                        </IconButton>
                        <LineEntry
                            className={classes.lineEntry}
                            callback={ (entry) => { dispatch(sendMessage(entry)) }}
                        />
                    </Toolbar>
                </Container>
            </AppBar>
            <RoomDialog
                open={roomDialogOpen}
                onClose={() => { setRoomDialogOpen(false) }}
                defaultValues={mostRecentRoomMessage || {}}
            />
            <NameDialog
                open={!name}
                defaultValue={name}
                onClose={(name) => () => {
                    dispatch(setName(name))
                }}
            />
            <Backdrop open={(name && !webSocket) ? true : false}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </React.Fragment>
    );
  }

export default Chat
