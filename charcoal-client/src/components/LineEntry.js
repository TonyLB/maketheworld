import React, { useState } from 'react'
import { TextField } from '@material-ui/core'

export const triggerOnEnter = (value, setValue) => (callback) => (e) => {
    if (e.key === 'Enter') {
        callback(value)
        setValue('')
    }
}

export const LineEntry = ({ callback = () => {}, ...rest }) => {
    const [value, setValue] = useState('')

    return <TextField
            placeholder='Enter your chat text here'
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={triggerOnEnter(value, setValue)(callback)}
            value={value}
            fullWidth
            {...rest}
        />
}

export default LineEntry