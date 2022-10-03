import React, { ReactChild, ReactChildren, ReactFragment } from 'react'

import {
    Box,
    Typography,
    ListItem,
    ListItemText
} from '@mui/material'

import MessageComponent from './MessageComponent'
import { WorldMessage as WorldMessageType } from '@tonylb/mtw-interfaces/dist/messages'
import TaggedMessageContent from './TaggedMessageContent'

interface WorldMessageProps {
    message: WorldMessageType;
    children?: ReactChild | ReactChildren;
}

const intersperseBrs = (entryList: string[]): ReactFragment => (
    (entryList.length > 1)
        ? <React.Fragment>
            { entryList.reduce((previous, entry, index) => ([
                ...previous,
                <React.Fragment key={index}>
                    { entry }
                    { (index < entryList.length - 1) && <br /> }
                </React.Fragment>
            ]), [] as ReactFragment[]) }
        </React.Fragment>
        : <React.Fragment>{ entryList[0] }</React.Fragment>
)

export const WorldMessage = ({ message, ...rest }: WorldMessageProps) => {
    //
    // TODO: Replace render here with the general utility function abstracted from RoomDescription
    // component
    //

    return <MessageComponent
            sx={{ paddingTop: "10px", paddingBottom: "10px", paddingRight: "25px", paddingLeft: "25px" }}
        >
            <Box sx={{ height: "100%" }}>
                <Typography variant='body1' align='left'>
                    <TaggedMessageContent list={message.Message} />
                </Typography>
            </Box>
        </MessageComponent>
}

export default WorldMessage