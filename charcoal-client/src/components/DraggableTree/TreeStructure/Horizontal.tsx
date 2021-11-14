import useTreeStyles from '../useTreeStyles'

export const HorizontalLine = ({}) => {
    const localClasses = useTreeStyles()
    return <div
        className={localClasses.HorizontalLine}
    />
}

export default HorizontalLine