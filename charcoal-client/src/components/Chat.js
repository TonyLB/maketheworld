// Foundational imports (React, Redux, etc.)
import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// MaterialUI imports
import {
    Typography,
    Container,
    Paper,
    Card,
    Grid,
    Avatar,
    Tooltip,
    Backdrop,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogActions,
    Button,
    TextField } from '@material-ui/core'

import {
    blue,
    pink,
    purple,
    green
} from "@material-ui/core/colors"
import { makeStyles } from "@material-ui/core/styles"

// Local code imports
import { receiveMessage, sendMessage } from '../actions/messages.js'
import { setName, registerName } from '../actions/name.js'
import { registerWebSocket } from '../actions/webSocket.js'
import { getMessages } from '../selectors/messages.js'
import { getWebSocket } from '../selectors/webSocket.js'
import { getName } from '../selectors/name.js'
import { getColorMap } from '../selectors/colorMap.js'
import LineEntry from '../components/LineEntry.js'

const useStyles = makeStyles(theme => ({
    ...(Object.entries({ blue, pink, purple, green }).map(([colorName, color]) => ({
        [colorName]: {
            color: theme.palette.getContrastText(color[500]),
            backgroundColor: color[500]
        },
        [`light${colorName}`]: {
            color: theme.palette.getContrastText(color[50]),
            backgroundColor: color[50]
        }
    })).reduce((prev, item) => ({ ...prev, ...item }), {}))
}))

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

const Message = ({ name, children, ...rest }) => {
    const colorMap = useSelector(getColorMap)
    const color = name && colorMap && colorMap[name]
    const classes = useStyles()
    return <React.Fragment {...rest} >
        <Card elevation={5} className={ color && classes[color.light] }>
            <Grid container wrap="nowrap" spacing={2}>
                <Grid item>
                    {
                        name && <div>
                            <Tooltip title={name}>
                                <Avatar className={color && classes[color.primary]}>
                                    { name[0].toUpperCase() }
                                </Avatar>
                            </Tooltip>
                        </div>
                    }
                </Grid>
                <Grid item xs>
                    <Typography variant='body1' align='left'>
                        {children}
                    </Typography>
                </Grid>
            </Grid>
        </Card>
        <br />
    </React.Fragment>
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
            <Container maxWidth="lg">
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
            </Container>
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
