//
// ThreadList lists threads, with options to click through in order to view them
//

import React from 'react'
import PropTypes from "prop-types"

// MaterialUI imports
import {
    List
} from '@material-ui/core'
import ThreadListItem from './ThreadListItem'

import useStyles from '../styles'

export const ThreadList = ({ threads = [], onView = () => {} }) => {
    const classes = useStyles()
    return <List className={classes.threadSelectionList}>
        {
            threads.map(({
                ThreadId,
                Subject,
                characters
            }, index) => (
                <ThreadListItem key={ThreadId || `Thread-${index}`} Subject={Subject} ThreadId={ThreadId} characters={characters} onView={() => { onView(ThreadId) }} />
            ))
        }
    </List>

}

ThreadList.propTypes = {
    threads: PropTypes.arrayOf(PropTypes.shape({
        ThreadId: PropTypes.string,
        Subject: PropTypes.string,
        characters: PropTypes.arrayOf(PropTypes.shape({
            Name: PropTypes.string,
            Pronouns: PropTypes.string,
            FirstImpression: PropTypes.string,
            OneCoolThing: PropTypes.string,
            Outfit: PropTypes.string,
            color: PropTypes.shape({
                primary: PropTypes.string,
                light: PropTypes.string
            })
        }))
    })),
    onView: PropTypes.func
}

export default ThreadList
