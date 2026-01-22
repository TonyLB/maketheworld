import React from 'react'
import useTreeStyles from '../useTreeStyles'
import Plus from '../Plus.svg'
import Dash from '../Dash.svg'

export const Collapsar = ({ left, open, onClick }: { left: number, open: boolean, onClick: any }) => {
    const localClasses = useTreeStyles()
    return <div
        style={{
            ...localClasses.Collapsar,
            left,
            backgroundImage: open ? `url(${Dash})` : `url(${Plus})`
        } as React.CSSProperties}
        onClick={onClick}
    />
}

export default Collapsar