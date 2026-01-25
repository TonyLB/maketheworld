import React, { useRef, useMemo, useCallback } from 'react'
import PropTypes from "prop-types"

import {
    List
} from '@mui/material'

import { GroupedVirtuoso, VirtuosoHandle } from 'react-virtuoso'
import { isPerceptionRoomMetaData } from '@tonylb/mtw-interfaces/ts/messages'

import { useActiveCharacter } from '../ActiveCharacter'
import { Message as MessageComponent } from '.'
import { RoomDescription } from './RoomDescription'

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
                    style={{padding: 0, ...style, margin: 0 }}
                    component="div"
                    ref={listRef}
                >
                    {children}
                </List>
            )) as any

        } as any
    }, [])

    const itemContent = useCallback((index: number) => (
            <MessageComponent message={messageBreakdown.Messages[index]} />
        ), [messageBreakdown.Messages])

    const groupContent = useCallback((index: number) => {
        const headerMessage = messageBreakdown.Groups[index].header
        
        // Validate that we have room metadata
        if (!headerMessage.metaData || !isPerceptionRoomMetaData(headerMessage.metaData)) {
            console.error('VirtualMessageList: Invalid room header metadata', headerMessage)
            return null
        }
        
        return (
            <RoomDescription 
                parsedWML={headerMessage.parsedWML}
                metaData={headerMessage.metaData}
                header 
                currentHeader={index >= messageBreakdown.Groups.length - 1} 
            />
        )
    }, [messageBreakdown.Groups])

    return (
        <GroupedVirtuoso
            groupCounts={groupCounts}
            groupContent={groupContent}
            components={Components}
            initialTopMostItemIndex={messageBreakdown.Messages.length - 1}
            overscan={{ main: 500, reverse: 500 }}
            itemContent={itemContent}
            followOutput={true}
            ref={virtuoso as any}
        />
    )
}

VirtualMessageList.propTypes = {
    messages: PropTypes.array
}
export default VirtualMessageList
