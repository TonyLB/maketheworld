import { animated } from 'react-spring'
import useTreeStyles from './useTreeStyles'

export const VerticalLine = animated(({ height, left }: { height: any, left: any }) => {
    const localClasses = useTreeStyles()
    return <animated.div
        className={localClasses.VerticalLine}
        style={{
            height,
            left: `${left}px`
        }}
    />
})

export default VerticalLine