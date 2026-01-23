import React from 'react'
import useTreeStyles from '../useTreeStyles'

export const TreeContent = <T extends object>({
        item,
        renderComponent,
        renderHandle = () => (null),
        bind
    }: {
        item: null | (T & { itemKey?: string }),
        renderComponent: (item: T & { itemKey?: string }) => React.ReactNode,
        renderHandle?: (item: T) => React.ReactNode,
        bind?: any
    }) => {
    const localClasses = useTreeStyles()
    return <div
        style={localClasses.TreeContentSections as React.CSSProperties}
    >
        <div {...(bind ? bind : {})} style={localClasses.TreeContentHandle as React.CSSProperties}>{ item && renderHandle(item) }</div>
        <div style={localClasses.TreeContent as React.CSSProperties}>
            { item && renderComponent(item) }
        </div>
    </div>
}

export default TreeContent