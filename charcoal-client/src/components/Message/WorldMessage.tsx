import React, { ReactChild, ReactChildren, ReactFragment } from 'react'

import {
    Typography,
    ListItem,
    ListItemText
} from '@mui/material'

import { WorldMessage as WorldMessageType } from '../../slices/messages/baseClasses'

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
    return <ListItem alignItems="flex-start" {...rest} >
        <ListItemText inset>
            <Typography variant='body1' align='left'>
                { intersperseBrs((message.Message).split('\n')) }
            </Typography>
        </ListItemText>
    </ListItem>
}

export default WorldMessage