import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
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
            <header className="App-header">
            Test of WebSockets
            {
                messages.map((message, index) => (
                <React.Fragment key={`Message-${index}`}>
                    <span>
                        {message}
                    </span>
                </React.Fragment>
                ))
            }
            <LineEntry
                callback={ (entry) => { dispatch(sendMessage(entry)) }}
            />
            </header>
        </div>
    );
  }

export default Chat
