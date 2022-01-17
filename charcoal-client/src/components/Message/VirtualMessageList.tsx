import React, { useRef, useMemo } from 'react'
import PropTypes from "prop-types"

import {
    List
} from '@material-ui/core'

import { Virtuoso, VirtuosoHandle, ItemContent } from 'react-virtuoso'

import { Message as MessageComponent } from '.'
import { Message as MessageType } from '../../slices/messages/baseClasses'

const itemContent: ItemContent<MessageType> = (_, data) => {
    //
    // TODO: Replace global clickable:true for RoomExits with clickable only on the most recent instance
    // of the current room description message
    //
    return <MessageComponent message={data} />
}

export const VirtualMessageList = ({ messages = [], viewAsCharacterId = '' }) => {
    const virtuoso = useRef<VirtuosoHandle>(null)

    const Components = useMemo(() => {
        return {
            //
            // TODO: Properly type-constrain this forwardRef
            //
            List: React.forwardRef<any, any>(({ style, children }, listRef) => (
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
