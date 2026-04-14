import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import PropTypes from "prop-types"

import {
    List
} from '@mui/material'

import { GroupedVirtuoso, VirtuosoHandle } from 'react-virtuoso'
import { isPerceptionRoomMetaData } from '@tonylb/mtw-interfaces/ts/messages'

import { useActiveCharacter } from '../ActiveCharacter'
import { Message as MessageComponent } from '.'
import { RoomDescription } from './RoomDescription'
import { MessageRoomBreakdownHeader } from '../../slices/messages/selectors'
import { mergePerceivedRoomForms } from '../../slices/messages/roomHeaderPhaseC'

/** Sticky header: merge render + affordance WML; withhold affordance slice until render catch-up or 10s. */
const StickyRoomGroupHeader = ({
    group,
    currentHeader
}: {
    group: MessageRoomBreakdownHeader
    currentHeader: boolean
}) => {
    const renderHeader = group.renderHeader
    const affordanceHeader = group.affordanceHeader
    const hasRenderHeader = Boolean(renderHeader)
    const renderParsed = renderHeader?.parsedWML
    const affordanceParsed = affordanceHeader?.parsedWML
    const sectionRoomId =
        group.header.metaData && isPerceptionRoomMetaData(group.header.metaData)
            ? group.header.metaData.componentUUID
            : ''

    const [includeAffordanceInMerge, setIncludeAffordanceInMerge] = useState(hasRenderHeader)

    useEffect(() => {
        if (hasRenderHeader) {
            setIncludeAffordanceInMerge(true)
            return
        }
        if (!affordanceHeader) {
            setIncludeAffordanceInMerge(true)
            return
        }
        setIncludeAffordanceInMerge(false)
        const t = window.setTimeout(() => setIncludeAffordanceInMerge(true), 10000)
        return () => window.clearTimeout(t)
    }, [hasRenderHeader, affordanceHeader?.MessageId, sectionRoomId])

    const parsedWML = useMemo(
        () =>
            includeAffordanceInMerge
                ? mergePerceivedRoomForms(renderParsed, affordanceParsed)
                : renderParsed,
        [includeAffordanceInMerge, renderParsed, affordanceParsed]
    )

    const headerMessage = group.header
    if (!headerMessage.metaData || !isPerceptionRoomMetaData(headerMessage.metaData)) {
        console.error('VirtualMessageList: Invalid room header metadata', headerMessage)
        return null
    }

    const isGenerating = Boolean(
        renderHeader &&
        isPerceptionRoomMetaData(renderHeader.metaData) &&
        renderHeader.metaData.status === 'generating' &&
        renderHeader.metaData.displayMode === 'header'
    )

    return (
        <RoomDescription
            parsedWML={parsedWML}
            metaData={headerMessage.metaData}
            header
            currentHeader={currentHeader}
            isGenerating={isGenerating}
        />
    )
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

    const groupContent = useCallback((index: number) => (
        <StickyRoomGroupHeader
            group={messageBreakdown.Groups[index]}
            currentHeader={index >= messageBreakdown.Groups.length - 1}
        />
    ), [messageBreakdown.Groups])

    return (
        <GroupedVirtuoso
            onPointerEnterCapture={() => {}}
            onPointerLeaveCapture={() => {}}
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
