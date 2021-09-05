import React, { FunctionComponent } from 'react'
import { animated } from 'react-spring'

type LayerRowProps = {
    zIndex: number;
    shadow: number;
    y: number;
    scale: number;
    item: string;
}

export const LayerRow: FunctionComponent<LayerRowProps>= ({ shadow, item, y, ...rest }) => {
    return <animated.div
        // style={{
        //     boxShadow: shadow.to((s) => `rgba(0, 0, 0, 0.15) 0px ${s}px ${2 * s}px 0px`),
        //     y,
        //     ...rest
        // }}
        children={item}
    />

}

export default animated(LayerRow)