import React from 'react'
import useTreeStyles from '../useTreeStyles'

export const TreeContent = <T extends object>({ item, renderComponent, renderHandle = () => (null), bind }: { item: null | T, renderComponent: (item: T) => React.ReactNode, renderHandle?: (item: T) => React.ReactNode, bind?: any }) => {
    const localClasses = useTreeStyles()
    return <div
        className={localClasses.TreeContentSections}
    >
        <div {...(bind ? bind : {})} className={localClasses.TreeContentHandle}>{ item && renderHandle(item) }</div>
        <div className={localClasses.TreeContent}>
            { item && renderComponent(item) }
        </div>
    </div>
}

export default TreeContent