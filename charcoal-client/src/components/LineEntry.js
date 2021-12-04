import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import {
    TextField
} from '@material-ui/core'

import { getSettings } from '../selectors/settings'
import { getClientSettings } from '../selectors/clientSettings'

export const LineEntry = ({ callback = () => {}, ...rest }) => {
    const [value, setValue] = useState('')
    const { ChatPrompt } = useSelector(getSettings)
    const { TextEntryLines } = useSelector(getClientSettings)

    return (
        <TextField
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
            {...rest}
        />
    )
}

export default LineEntry