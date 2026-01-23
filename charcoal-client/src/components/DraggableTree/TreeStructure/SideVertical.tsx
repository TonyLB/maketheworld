import React from 'react'
import useTreeStyles from '../useTreeStyles'

export const SideVerticalLine = ({ height }: { height: any }) => {
    const localClasses = useTreeStyles()
    return <div
        style={{
            ...localClasses.SideVerticalLine,
            height
        } as React.CSSProperties}
    />
}

export default SideVerticalLine