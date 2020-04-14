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

export const LineEntry = ({ callback = () => {}, ...rest }) => {
    const availableBehaviors = useSelector(getAvailableBehaviors)
    const [value, setValue] = useState('')
    const [open, setAutocompleteOpen] = useState(false)

    return (
        <Autocomplete
            id="line-entry-autocomplete"
            freeSolo
            open={open}
            options={availableBehaviors}
            style={{ width: "100%" }}
            PopperComponent={(props) => (<Popper {...props} placement={"top"} />)}
            inputValue={value}
            onClose={() => {
                setAutocompleteOpen(false)
            }}
            onChange={(_, incomingValue) => {
                callback(incomingValue || '')
                setAutocompleteOpen(false)
                setValue('')
            }}
            onInputChange={(_, incomingValue, reason) => {
                if (reason === 'input') {
                    setValue(incomingValue || '')
                }
            }}
            renderInput={(params) => {
                return <TextField
                    {...params}
                    placeholder='Enter your chat text here'
                    onKeyPress={(event) => {
                        if (event.key === 'Enter' && !open) {
                            callback(value || '')
                            setValue('')
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