// Foundational imports (React, Redux, etc.)
import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

// MaterialUI imports
import { Typography, Paper, Card } from '@material-ui/core'

// Local code imports
import { receiveMessage, sendMessage } from '../actions/messages.js'
import { registerWebSocket } from '../actions/webSocket.js'
import { getMessages } from '../selectors/messages.js'
import LineEntry from '../components/LineEntry.js'

export const Chat = () => {
    const [webSocket, setWebSocket] = useState(null)

    const messages = useSelector(getMessages)
    const dispatch = useDispatch()

    useEffect(() => {
        if (!webSocket) {
          let setupSocket = new WebSocket('>INSERT WSS ADDRESS<')
          setupSocket.onopen = () => {
            console.log('WebSocket Client Connected')
          }
          setupSocket.onmessage = (message) => {
            dispatch(receiveMessage(message.data))
          }
          dispatch(registerWebSocket(setupSocket))
          setWebSocket(setupSocket)
        }
    }, [webSocket, setWebSocket, dispatch])
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
        </div>
    );
  }

export default Chat
