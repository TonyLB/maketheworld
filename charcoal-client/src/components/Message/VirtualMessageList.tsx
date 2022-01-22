import React, { useRef, useMemo, useCallback } from 'react'
import PropTypes from "prop-types"

import {
    List
} from '@material-ui/core'

import { GroupedVirtuoso, VirtuosoHandle, GroupItemContent } from 'react-virtuoso'

import { useActiveCharacter } from '../ActiveCharacter'
import { Message as MessageComponent } from '.'
import { RoomDescription } from './RoomDescription'
import { Message as MessageType } from '../../slices/messages/baseClasses'

const itemContent: GroupItemContent<MessageType> = (index, groupIndex, data) => {
    //
    // TODO: Replace global clickable:true for RoomExits with clickable only on the most recent instance
    // of the current room description message
    //
    return <MessageComponent message={data} />
}

export const VirtualMessageList = () => {
    const { messageBreakdown } = useActiveCharacter()
    const virtuoso = useRef<VirtuosoHandle>(null)

    const groupCounts = useMemo(() => (
        messageBreakdown.Groups.map(({ messageCount }) => (messageCount))
    ), [messageBreakdown.Groups])

    const Components = useMemo(() => {
        return {
            //
            // TODO: Properly type-constrain this forwardRef
            //
            List: React.forwardRef<any, any>(({ style, children }, listRef) => (
                <List
                    style={{padding: 0, ...style, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 }}
                    component="div"
                    ref={listRef}
                >
                    {children}
                </List>
            ))

        }
    }, [])

    const groupContent = useCallback(((index: number) => (
            <RoomDescription message={messageBreakdown.Groups[index].header} />
        )), [messageBreakdown.Groups])

    return (
        <GroupedVirtuoso
            data={messageBreakdown.Messages}
            groupCounts={groupCounts}
            groupContent={groupContent}
            components={Components}
            initialTopMostItemIndex={messageBreakdown.Messages.length - 1}
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
