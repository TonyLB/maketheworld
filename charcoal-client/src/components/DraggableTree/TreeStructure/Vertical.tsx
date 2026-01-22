import React from 'react'
import useTreeStyles from '../useTreeStyles'

export const VerticalLine = ({ height, left }: { height: any, left: any }) => {
    const localClasses = useTreeStyles()
    return <div
        style={{
            ...localClasses.VerticalLine,
            height,
            left: `${left}px`
        } as React.CSSProperties}
    />
}

export default VerticalLine