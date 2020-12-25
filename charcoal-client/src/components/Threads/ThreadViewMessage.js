import React, { useMemo } from 'react'
import PropTypes from "prop-types"

import {
    Typography,
    Avatar,
    Tooltip,
    ListItem,
    ListItemText,
    ListItemAvatar
} from '@material-ui/core'

import useStyles from '../styles'

export const ThreadViewMessage = React.forwardRef(({
        Message,
        fromName,
        fromColor = 'blue',
        fromSelf = false,
        MessageTime,
        ...rest }, ref) => {
    const color = fromSelf ? 'Blue' : `${fromColor.charAt(0).toUpperCase()}${fromColor.slice(1)}`
    const classes = useStyles()
    const timeString = useMemo(() => (new Date(MessageTime).toLocaleString()), [MessageTime])
    return <div className={ color && classes[`player${color}`] }>
        <ListItem
            ref={ref}
            className={`${classes.threadViewMessage} threadViewMessageColor`}
            classes={{ root: fromSelf ? classes.threadViewSelf : classes.threadViewOther }}
            alignItems="flex-start"
            {...rest}
        >
            <ListItemAvatar>
                <Tooltip title={fromName || '?'}>
                    <Avatar className='avatarColor'>
                        { (fromName && fromName[0].toUpperCase()) || '?' }
                    </Avatar>
                </Tooltip>
            </ListItemAvatar>
            <ListItemText
                primary={<Typography justify="center">{Message}</Typography>}
                secondary={<React.Fragment>{fromName} at {timeString}</React.Fragment>}
            />
        </ListItem>
    </div>
})

ThreadViewMessage.propTypes = {
    Message: PropTypes.string,
    MessageTime: PropTypes.number,
    fromName: PropTypes.string,
    fromColor: PropTypes.string,
    fromSelf: PropTypes.bool,
}

export default ThreadViewMessage