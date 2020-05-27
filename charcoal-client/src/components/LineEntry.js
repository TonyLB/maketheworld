import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import {
    TextField,
    InputAdornment,
    IconButton,
    Popper
} from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import HelpIcon from '@material-ui/icons/Help'

import { getAvailableBehaviors } from '../selectors/currentRoom'
import { getSettings } from '../selectors/settings'
import { getClientSettings } from '../selectors/clientSettings'

export const LineEntry = ({ callback = () => {}, ...rest }) => {
    const availableBehaviors = useSelector(getAvailableBehaviors)
    const [value, setValue] = useState('')
    const [open, setAutocompleteOpen] = useState(false)
    const { ChatPrompt } = useSelector(getSettings)
    const { TextEntryLines } = useSelector(getClientSettings)

    return (
        <Autocomplete
            id="line-entry-autocomplete"
            freeSolo
            open={open}
            options={availableBehaviors}
            style={{ width: "100%", margin: "5px" }}
            PopperComponent={(props) => (<Popper {...props} placement={"top"} />)}
            inputValue={value}
            onClose={() => {
                setAutocompleteOpen(false)
            }}
            onChange={(_, incomingValue) => {
                const callbackResult = callback(incomingValue || '')
                setAutocompleteOpen(false)
                if (callbackResult) {
                    setValue('')
                }
            }}
            onInputChange={(_, incomingValue, reason) => {
                if (reason === 'input') {
                    setValue(incomingValue || '')
                }
            }}
            renderInput={(params) => {
                return <TextField
                    {...params}
                    placeholder={ChatPrompt}
                    multiline={!(TextEntryLines === 1)}
                    rows={TextEntryLines || 2}
                    onKeyPress={(event) => {
                        if (event.key === 'Enter' && !open) {
                            const callbackResult = callback(value || '')
                            if (callbackResult) {
                                setValue('')
                            }
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowUp' && !open) {
                            setAutocompleteOpen(true)
                        }
                    }}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={() => { setAutocompleteOpen(!open) }}>
                                    <HelpIcon />
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                    fullWidth
                    {...rest}
                />
            }}
        />
    )
}

export default LineEntry