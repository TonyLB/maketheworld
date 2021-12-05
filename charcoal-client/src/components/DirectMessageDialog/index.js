// Foundational imports (React, Redux, etc.)
import React, { useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    TextField
} from '@material-ui/core'

// Local code imports
import { closeDirectMessageDialog } from '../../actions/UI/directMessageDialog'
import { sendDirectMessage } from '../../actions/messages'
import { getDirectMessageTargetUI } from '../../selectors/UI/directMessageDialog.js'
import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import { useActiveCharacter } from '../ActiveCharacter'

import useStyles from '../styles'

export const DirectMessageDialog = () => {
    const ToCharacterId = useSelector(getDirectMessageTargetUI)
    const charactersInPlay = useSelector(getCharactersInPlay)
    const { CharacterId: characterId } = useActiveCharacter()
    const ToCharacter = (ToCharacterId && charactersInPlay && charactersInPlay[ToCharacterId]) || {}
    const dispatch = useDispatch()
    const [value, setValue] = useState('')
    const inputRef = useCallback((node) => { if (node) { node.focus() } }, [])

    const classes = useStyles()
    return(
        <Dialog
            width="lg"
            open={Boolean(ToCharacterId)}
        >
            <DialogTitle id="direct-message-dialog-title" className={classes.lightblue}>Direct Message</DialogTitle>
            <DialogContent>
                <Typography variant="h5" gutterBottom >
                    To: {ToCharacter.Name || ''}
                </Typography>
                <TextField
                    style={{ width: "500px" }}
                    placeholder='Enter your direct message text here'
                    value={value}
                    multiline
                    rows={4}
                    onChange={(event) => { setValue(event.target.value) }}
                    inputRef={inputRef}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={ () => {
                    dispatch(closeDirectMessageDialog())
                    setValue('')
                } }>
                    Cancel
                </Button>
                <Button onClick={ () => {
                    dispatch(sendDirectMessage({ Characters: [ characterId, ToCharacterId ], Recipients: [ ToCharacterId ], CharacterId: characterId, Message: value }))
                    dispatch(closeDirectMessageDialog())
                    setValue('')
                }}>
                    Send
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default DirectMessageDialog