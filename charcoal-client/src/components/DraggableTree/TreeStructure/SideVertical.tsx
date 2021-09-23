import { animated } from 'react-spring'
import useTreeStyles from './useTreeStyles'

export const SideVerticalLine = animated(({ height }: { height: any }) => {
    const localClasses = useTreeStyles()
    return <animated.div
        className={localClasses.SideVerticalLine}
        style={{
            height
        }}
    />
})

export default SideVerticalLine