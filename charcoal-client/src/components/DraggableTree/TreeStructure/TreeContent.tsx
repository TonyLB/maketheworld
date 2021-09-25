import useTreeStyles from '../useTreeStyles'

export const TreeContent = ({ name, bind }: { name: string, bind?: any }) => {
    const localClasses = useTreeStyles()
    return <div
        className={localClasses.TreeContentSections}
    >
        <div {...(bind ? bind : {})} className={localClasses.TreeContentHandle} />
        <div className={localClasses.TreeContent}>
            {name}
        </div>
    </div>
}

export default TreeContent