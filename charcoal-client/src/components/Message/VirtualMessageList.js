import React, { useRef, useMemo } from 'react'
import PropTypes from "prop-types"

import {
    List
} from '@material-ui/core'

import { Virtuoso } from 'react-virtuoso'

import CharacterAvatar from '../CharacterAvatar'
import MessageContent from './MessageContent'
import MessageThread from './MessageThread'
import MessageTime from './MessageTime'
import { PolymorphicMessage } from '../Message'

const itemContent = (viewAsCharacterId) => (index, data) => {
    const { CharacterId, Message, MessageTime: MessageTimeData, ThreadId } = data
    return <PolymorphicMessage viewAsCharacterId={viewAsCharacterId}>
        { CharacterId && <CharacterAvatar CharacterId={CharacterId} />}
        { Message && <MessageContent>{Message}</MessageContent>}
        { ThreadId && <MessageThread thread={ThreadId} />}
        { MessageTimeData && <MessageTime time={MessageTimeData} />}
    </PolymorphicMessage>
}

export const VirtualMessageList = ({ messages = [], viewAsCharacterId = '' }) => {
    const virtuoso = useRef()

    const Components = useMemo(() => {
        return {
            List: React.forwardRef(({ style, children }, listRef) => (
                <List
                    style={{padding: 0, ...style, margin: 0}}
                    component="div"
                    ref={listRef}
                >
                    {children}
                </List>
            ))

        }
    }, [])

    return (
        <Virtuoso
            data={messages}
            components={Components}
            initialTopMostItemIndex={messages.length - 1}
            overscan={{ main: 500, reverse: 500 }}
            itemContent={itemContent(viewAsCharacterId)}
            followOutput={true}
            ref={virtuoso}
        />
    )
}

VirtualMessageList.propTypes = {
    messages: PropTypes.array
}
export default VirtualMessageList
