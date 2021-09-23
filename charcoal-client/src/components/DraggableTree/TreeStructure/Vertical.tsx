import useTreeStyles from './useTreeStyles'

export const VerticalLine = ({ height, left }: { height: any, left: any }) => {
    const localClasses = useTreeStyles()
    return <div
        className={localClasses.VerticalLine}
        style={{
            height,
            left: `${left}px`
        }}
    />
}

export default VerticalLine