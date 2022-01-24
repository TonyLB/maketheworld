import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import {
    TextField
} from '@mui/material'

import { getServerSettings, getClientSettings } from '../slices/settings'

export const LineEntry = ({ callback = (entry: any) => (true) }) => {
    const [value, setValue] = useState('')
    const { ChatPrompt } = useSelector(getServerSettings)
    const { TextEntryLines } = useSelector(getClientSettings)

    return (
        <TextField
            sx={{ bgcolor: 'background.default' }}
            placeholder={ChatPrompt}
            multiline={!(TextEntryLines === 1)}
            rows={TextEntryLines || 2}
            value={value}
            onKeyPress={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    const callbackResult = callback(value || '')
                    if (callbackResult) {
                        setValue('')
                    }
                }
            }}
            onChange={(event) => {
                setValue(event.target.value)
            }}
            fullWidth
        />
    )
}

export default LineEntry