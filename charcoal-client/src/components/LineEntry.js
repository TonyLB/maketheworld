import React, { useState } from 'react'

export const triggerOnEnter = (value) => (callback) => (e) => {
    if (e.key === 'Enter') {
        callback(value)
    }
}

export const LineEntry = ({ callback = () => {} }) => {
    const [value, setValue] = useState('')

    return <input
            placeholder='Enter your chat text here'
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={triggerOnEnter(value)(callback)}
            value={value}
        />
}

export default LineEntry