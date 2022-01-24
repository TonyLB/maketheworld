//
// ThreadListItem shows one thread header in the ThreadList
//

/** @jsxImportSource @emotion/react */
import React from 'react'
import { css } from '@emotion/react'
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
        css={css`
            cursor: pointer;
            user-select: none;
            border-radius: 10px;
            border-width: 1px;
            border-style: solid;
            '&:hover': {
                background-color: ${blue[50]},
                color: black
            }
        `}
        sx={{ bgcolor: grey[50], borderColor: grey[500] }}
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
