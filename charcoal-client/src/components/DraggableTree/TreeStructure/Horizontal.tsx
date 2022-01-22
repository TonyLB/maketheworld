import useTreeStyles from '../useTreeStyles'

// eslint-disable-next-line no-empty-pattern
export const HorizontalLine = ({}) => {
    const localClasses = useTreeStyles()
    return <div
        className={localClasses.HorizontalLine}
    />
}

export default HorizontalLine