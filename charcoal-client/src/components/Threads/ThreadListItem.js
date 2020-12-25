//
// ThreadListItem shows one thread header in the ThreadList
//

import React from 'react'
import PropTypes from "prop-types"

// MaterialUI imports
import {
    ListItem,
    ListItemText,
    ListItemSecondaryAction
} from '@material-ui/core'

import useStyles from '../styles'
import CharacterChip from '../CharacterChip'

export const ThreadListItem = ({ ThreadId = '', Subject = '', onView = () => {}, characters = [], ...rest }) => {
    const classes = useStyles()

    return <ListItem className={classes.threadListItem} onClick={() => { onView(ThreadId) }} {...rest} >
        <ListItemText>
            { Subject }
        </ListItemText>
        <ListItemSecondaryAction>
            {
                (characters ?? []).map((CharacterId) => (
                    <CharacterChip
                        key={CharacterId}
                        CharacterId={CharacterId}
                    />
                ))
            }
        </ListItemSecondaryAction>
    </ListItem>
}

ThreadListItem.propTypes = {
    ThreadId: PropTypes.string,
    Subject: PropTypes.string,
    characters: PropTypes.arrayOf(PropTypes.string),
    onView: PropTypes.func
}

export default ThreadListItem
