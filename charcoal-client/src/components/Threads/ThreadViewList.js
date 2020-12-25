import React from 'react'
import PropTypes from "prop-types"

import {
    List
} from '@material-ui/core'

import ThreadViewMessage from './ThreadViewMessage'

export const ThreadViewList = ({
        Messages,
        viewAsCharacterId,
        ...rest }) => {
    return <List {...rest} >
        { Messages.map(({
            Message,
            MessageTime,
            FromCharacterId,
            fromName,
            fromColor
        }) => (
            <ThreadViewMessage
                Message={Message}
                MessageTime={MessageTime}
                fromSelf={FromCharacterId === viewAsCharacterId}
                fromName={fromName}
                fromColor={fromColor}
            />
        ))}
    </List>
}

ThreadViewList.propTypes = {
    Messages: PropTypes.arrayOf(PropTypes.shape({
        Message: PropTypes.string,
        MessageTime: PropTypes.number,
        FromCharacterId: PropTypes.string,
        fromName: PropTypes.string,
        fromColor: PropTypes.string,
        fromSelf: PropTypes.bool
    }))
}

export default ThreadViewList