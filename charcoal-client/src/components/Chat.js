// Foundational imports (React, Redux, etc.)
import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// MaterialUI imports
import {
    Typography,
    Paper,
    Card,
    Avatar,
    Backdrop,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogActions,
    Button,
    TextField } from '@material-ui/core'

// Local code imports
import { receiveMessage, sendMessage } from '../actions/messages.js'
import { setName, registerName } from '../actions/name.js'
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

const Message = ({ name, children, ...rest }) => (
    <React.Fragment {...rest} >
        <Card elevation={5} >
            {
                name && <div>
                    <Avatar>
                        { name[0].toUpperCase() }
                    </Avatar>
                    <Typography variant='body2' align='left'>
                        {name}
                    </Typography>
                </div>
            }
            <div style={{
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Typography variant='body1' align='center'>
                    {children}
                </Typography>
            </div>
        </Card>
        <br />
    </React.Fragment>
)

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
    return (
        <div className="App">
            <Paper>
                <Typography variant='h2' align='center' gutterBottom>
                    Test of WebSockets
                </Typography>
                {
                    messages.map(({ name = '', message }, index) => (
                        <Message key={`Message-${index}`} name={name} >
                            {message}
                        </Message>
                    ))
                }
                <LineEntry
                    callback={ (entry) => { dispatch(sendMessage(entry)) }}
                />
            </Paper>
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
        </div>
    );
  }

export default Chat
