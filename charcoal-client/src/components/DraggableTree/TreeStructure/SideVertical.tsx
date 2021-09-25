import useTreeStyles from '../useTreeStyles'

export const SideVerticalLine = ({ height }: { height: any }) => {
    const localClasses = useTreeStyles()
    return <div
        className={localClasses.SideVerticalLine}
        style={{
            height
        }}
    />
}

export default SideVerticalLine