import React from 'react'
import useTreeStyles from '../useTreeStyles'

// eslint-disable-next-line no-empty-pattern
export const HorizontalLine = ({}) => {
    const localClasses = useTreeStyles()
    return <div
        style={localClasses.HorizontalLine as React.CSSProperties}
    />
}

export default HorizontalLine