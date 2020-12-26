import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react'
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

const itemContent = (index, data) => {
    const { CharacterId, Message, MessageTime: MessageTimeData, ThreadId } = data
    return <PolymorphicMessage>
        { CharacterId && <CharacterAvatar CharacterId={CharacterId} />}
        { Message && <MessageContent>{index}. {Message}</MessageContent>}
        { ThreadId && <MessageThread thread={ThreadId} />}
        { MessageTimeData && <MessageTime time={MessageTimeData} />}
    </PolymorphicMessage>
}

export const VirtualMessageList = ({ messages = [] }) => {
    const INITIAL_ITEM_COUNT = 50
    const ROWS_TO_UNHIDE_PER_INFINITE_SCROLL = 100
    const virtuoso = useRef()
    const [firstItemIndex, setFirstItemIndex] = useState(Math.max(messages.length - INITIAL_ITEM_COUNT, 0))

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
            )),

            // Item: ({ children, ...props }) => (
            //     <div><PolymorphicMessage {...props} >{children}</PolymorphicMessage></div>
            // ),

            // Group: ({ children, ...props }) => (
            //     <ListSubheader
            //         component="div"
            //         {...props}
            //         style={{
            //             backgroundColor: 'var(--ifm-background-color)',
            //             margin: 0
            //         }}
            //         disableSticky={true}
            //     >
            //         {children}
            //     </ListSubheader>
            // )
        }
    }, [])

    //
    // Expand the range of the passed message data that gets displayed in the
    // scrolling area
    //
    const showMore = useCallback(() => {
        console.log('showMore')
        if (firstItemIndex === 0) {
            return
        }

        const rowsUnshifted = Math.min(firstItemIndex, ROWS_TO_UNHIDE_PER_INFINITE_SCROLL)
        if (rowsUnshifted > 0) {
            setFirstItemIndex(() => (firstItemIndex - rowsUnshifted))
            console.log(`New firstIndex: ${firstItemIndex - rowsUnshifted}`)
        }
        return false
    }, [firstItemIndex, setFirstItemIndex])

    const [data, setData] = useState(messages.slice(firstItemIndex))

    useEffect(() => {
        setData(messages.slice(firstItemIndex))
    }, [messages, firstItemIndex])

    return (
        <Virtuoso
            data={data}
            components={Components}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={data.length - 1}
            defaultItemHeight={50}
            overscan={{ main: 20, reverse: 20 }}
            startReached={showMore}
            itemContent={itemContent}
            followOutput={true}
            ref={virtuoso}
        />
    )
}

VirtualMessageList.propTypes = {
    messages: PropTypes.array
}
export default VirtualMessageList
