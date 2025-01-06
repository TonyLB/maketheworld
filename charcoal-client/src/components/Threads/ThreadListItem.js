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
} from '@mui/material'
import { grey, blue } from '@mui/material/colors'

import CharacterChip from '../CharacterChip'

export const ThreadListItem = ({ ThreadId = '', Subject = '', onView = () => {}, characters = [], ...rest }) => {

    return <ListItem
        sx={{
            cursor: 'pointer',
            userSelect: 'none',
            borderRadius: '10px',
            borderWidth: '1px',
            borderStyle: 'solid',
            '&:hover': {
                backgroundColor: blue[50],
                color: 'black'
            },
            bgcolor: grey[50],
            borderColor: grey[500]
        }}
        onClick={() => { onView(ThreadId) }} {...rest}
    >
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
