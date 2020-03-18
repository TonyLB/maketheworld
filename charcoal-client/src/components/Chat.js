// Foundational imports (React, Redux, etc.)
import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// MaterialUI imports
import {
    Typography,
    Paper,
    Card,
    Backdrop,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogActions,
    Button,
    TextField } from '@material-ui/core'

// Local code imports
import { receiveMessage, sendMessage } from '../actions/messages.js'
import { setName } from '../actions/name.js'
import { registerWebSocket } from '../actions/webSocket.js'
import { getMessages } from '../selectors/messages.js'
import { getWebSocket } from '../selectors/webSocket.js'
import { getName } from '../selectors/name.js'
import LineEntry from '../components/LineEntry.js'

const NameDialog = ({ defaultValue, open, onClose = () => {} }) => {
    const [ localName, setLocalName ] = useState(defaultValue)
    const handleClose = onClose(localName)

    return(
        <Dialog maxWidth="lg" onClose={handleClose} open={open} >
            <DialogTitle id="name-dialog-title">Choose a Name</DialogTitle>
            <TextField
                fullWidth
                placeholder='Enter your name here'
                onChange={(e) => setLocalName(e.target.value)}
                value={localName}
            />
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
    const name = useSelector(getName)

    const dispatch = useDispatch()

    useEffect(() => {
        if (name && !webSocket) {
          let setupSocket = new WebSocket('>INSERT WSS ADDRESS<')
          setupSocket.onopen = () => {
            console.log('WebSocket Client Connected')
          }
          setupSocket.onmessage = (message) => {
            dispatch(receiveMessage(message.data))
          }
          dispatch(registerWebSocket(setupSocket))
        }
    }, [webSocket, name, dispatch])
    return (
        <div className="App">
            <Paper>
                <Typography variant='h2' align='center' gutterBottom>
                    Test of WebSockets
                </Typography>
                {
                    messages.map((message, index) => (
                        <React.Fragment>
                            <Card key={`Message-${index}`} elevation={5} >
                                <Typography variant='body1' align='center'>
                                    {message}
                                </Typography>
                            </Card>
                            <br />
                        </React.Fragment>
                    ))
                }
                <LineEntry
                    callback={ (entry) => { dispatch(sendMessage(entry)) }}
                />
            </Paper>
            <NameDialog
                open={!name}
                defaultValue={name}
                onClose={(name) => () => { dispatch(setName(name)) }}
            />
            <Backdrop open={name && !webSocket}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </div>
    );
  }

export default Chat
