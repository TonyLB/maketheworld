import { animated } from 'react-spring'
import useTreeStyles from './useTreeStyles'

export const HorizontalLine = ({}) => {
    const localClasses = useTreeStyles()
    return <animated.div
        className={localClasses.HorizontalLine}
    />
}

export default HorizontalLine