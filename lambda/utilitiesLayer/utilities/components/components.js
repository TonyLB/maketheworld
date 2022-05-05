const joinRenderItems = function * (render = []) {
    if (render.length > 0) {
        let currentItem = render[0]
        if (currentItem.spaceBefore) {
            if (currentItem.tag === 'String') {
                currentItem.value = ` ${currentItem.value}`
            }
            else {
                yield {
                    tag: 'String',
                    value: ' '
                }
            }
        }
        for (const renderItem of render.slice(1)) {
            const spaceBetween = currentItem.spaceAfter || renderItem.spaceBefore
            if (spaceBetween && currentItem.tag === 'String') {
                yield {
                    ...currentItem,
                    value: `${currentItem.value.trim()} `
                }
            }
            else {
                yield currentItem
            }
            if (spaceBetween && currentItem.tag !== 'String' && renderItem.tag !== 'String') {
                yield {
                    tag: 'String',
                    value: ' '
                }
            }
            if (spaceBetween && currentItem.tag !== 'String' && renderItem.tag === 'String') {
                currentItem = {
                    ...renderItem,
                    value: ` ${renderItem.value.trimLeft()}`
                }
            }
            else {
                currentItem = renderItem
            }
        }
        yield currentItem
    }
}

export const componentAppearanceReduce = (...renderList) => {
    const joinedList = renderList.reduce((previous, current) => ({
        render: [
            ...(previous.render || []),
            ...(current.render || [])
        ],
        name: [
            ...(previous.name || []),
            ...(current.name || [])
        ],
        features: [
            ...(previous.features || []),
            ...(current.features || [])
        ],
        exits: [
            ...(previous.exits || []),
            ...(current.exits || [])
        ],
    }))
    return {
        ...joinedList,
        render: [...joinRenderItems(joinedList.render)]
    }
}