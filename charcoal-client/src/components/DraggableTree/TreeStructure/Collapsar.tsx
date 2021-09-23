import { animated, SpringValue } from 'react-spring'
import useTreeStyles from './useTreeStyles'
import Plus from './Plus.svg'
import Dash from './Dash.svg'

export const Collapsar = ({ left, open, onClick }: { left: number, open: boolean, onClick: any }) => {
    const localClasses = useTreeStyles()
    return <div
        className={localClasses.Collapsar}
        onClick={onClick}
        style={{
            left,
            backgroundImage: open ? `url(${Dash})` : `url(${Plus})`
        }}
    />
}

export default Collapsar