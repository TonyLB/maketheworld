export const aggregateErrors = ({ contents = [], errors = [], ...rest }) => ({
    contents,
    errors: contents.reduce((previous, { errors = [] }) => ([...previous, ...errors]), errors),
    ...rest
})

export const desourceTag = ({ tag, ...rest }) => ({ tag: tag.sourceString, ...rest })

export const liftKeyProps = (liftKeyProps = []) => ({ props, ...rest }) => {
    return {
        ...rest,
        //
        // Lift the specified key props out of their structure to this level
        //
        ...(liftKeyProps.reduce((previous, key) => ({ ...previous, [key]: props?.[key]?.key }), {})),
        //
        // Pass on the props that aren't lifted in their more complex structure
        //
        props: Object.entries(props).filter(([key]) => (!liftKeyProps.includes(key))).reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
    }

}

export const liftLiteralProps = (liftLiteralProps = []) => ({ props, ...rest }) => {
    return {
        ...rest,
        //
        // Lift the specified literal props out of their structure to this level
        //
        ...(liftLiteralProps.reduce((previous, key) => ({ ...previous, [key]: props?.[key]?.literal }), {})),
        //
        // Pass on the props that aren't lifted in their more complex structure
        //
        props: Object.entries(props).filter(([key]) => (!liftLiteralProps.includes(key))).reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
    }

}

export const liftExpressionProps = (liftExpressionProps = []) => ({ props, ...rest }) => {
    return {
        ...rest,
        //
        // Lift the specified expression props out of their structure to this level
        //
        ...(liftExpressionProps.reduce((previous, key) => ({ ...previous, [key]: props?.[key]?.expression }), {})),
        //
        // Pass on the props that aren't lifted in their more complex structure
        //
        props: Object.entries(props).filter(([key]) => (!liftExpressionProps.includes(key))).reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
    }

}

export const liftBooleanProps = (liftBooleanProps = []) => ({ props, ...rest }) => {
    return {
        ...rest,
        //
        // Lift the specified expression props out of their structure to this level
        //
        ...(liftBooleanProps.reduce((previous, key) => ({ ...previous, [key]: props?.[key]?.literal || false }), {})),
        //
        // Pass on the props that aren't lifted in their more complex structure
        //
        props: Object.entries(props).filter(([key]) => (!liftBooleanProps.includes(key))).reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
    }

}

export const liftLiteralTags = (tagsMap) => ({ contents = [], ...rest}) => {
    const tags = Object.keys(tagsMap)
    const tagsToLift = contents.filter(({ tag }) => (tags.includes(tag)))
    const unliftedItems = contents.filter(({ tag }) => (!tags.includes(tag)))
    const tagOutcomes = tagsToLift.reduce((previous, { tag, contents }) => ({
        ...previous,
        [tagsMap[tag]]: contents.filter((value) => (value)).join(' ').trim()
    }), {})
    return {
        contents: unliftedItems,
        ...rest,
        ...tagOutcomes
    }
}

export const liftUntagged = (label, { separator = '', allString = false } = {}) => ({ contents = [], ...rest }) => {
    const itemsToLift = contents.filter(({ tag }) => (!tag))
    const unliftedTags = contents.filter(({ tag }) => (tag))
    const aggregationReducer = ({ listItems, currentItem }, item) => {
        if (typeof currentItem === 'string' && typeof item === 'string') {
            return { listItems, currentItem: [currentItem, item].join(separator) }
        }
        else {
            return {
                listItems: [
                    ...listItems,
                    ...(currentItem ? [currentItem] : [])
                ],
                currentItem: item
            }
        }
    }
    const aggregation = (items) => {
        const { listItems, currentItem } = items.reduce(aggregationReducer, { listItems: [] })
        return [
            ...listItems,
            ...(currentItem ? [currentItem] : [])
        ]
    }

    const aggregatedValue = aggregation(itemsToLift)
    return {
        contents: unliftedTags,
        ...rest,
        [label]: allString ? aggregatedValue[0] : aggregatedValue
    }
    
}

export const liftContents = (label, { separator = '', allString = false, exclude = [] } = {}) => ({ contents = [], ...rest }) => {
    const aggregationReducer = ({ listItems, currentItem, contents }, item) => {
        if (typeof currentItem === 'string' && typeof item === 'string') {
            return { listItems, contents, currentItem: [currentItem, item].join(separator) }
        }
        else {
            if (exclude.includes(item.tag)) {
                return {
                    listItems,
                    currentItem,
                    contents: [
                        ...(contents || []),
                        item
                    ]
                }
            }
            return {
                listItems: [
                    ...listItems,
                    ...(currentItem ? [currentItem] : [])
                ],
                currentItem: item,
                contents
            }
        }
    }

    const { listItems, currentItem, contents: newContents } = contents.reduce(aggregationReducer, { listItems: [], contents: [] })
    const aggregatedValue = [
        ...listItems,
        ...(currentItem ? [currentItem] : [])
    ]
    return {
        contents: newContents,
        ...rest,
        [label]: allString ? aggregatedValue[0] : aggregatedValue
    }
    
}

export const liftUseTags = ({ contents = [], ...rest}) => {
    const tagsToLift = contents.filter(({ tag }) => (tag === 'Use'))
    const unliftedItems = contents.filter(({ tag }) => (tag !== 'Use'))
    const mapping = tagsToLift.reduce((previous, { key, as }) => ({
        ...previous,
        [as || key]: key
    }), {})
    return {
        contents: unliftedItems,
        ...rest,
        mapping
    }
}

export const liftDependencyTags = ({ contents = [], ...rest}) => {
    const tagsToLift = contents.filter(({ tag }) => (tag === 'Depend'))
    const unliftedItems = contents.filter(({ tag }) => (tag !== 'Depend'))
    const dependencies = tagsToLift.reduce((previous, { on }) => ([
        ...previous,
        on
    ]), [])
    return {
        contents: unliftedItems,
        ...rest,
        dependencies
    }
}

export const liftRoomLocations = ({ contents = [], ...rest}) => {
    const tagsToLift = contents.filter(({ tag }) => (tag === 'Room'))
    const rooms = tagsToLift.reduce((previous, { key, x, y }) => ({
        ...previous,
        [key]: {
            x: parseFloat(x || ''),
            y: parseFloat(y || '')
        }
    }), {})
    const mappedContents = contents.map(({ x, y, ...rest }) => (rest))
    return {
        contents: mappedContents,
        ...rest,
        rooms
    }
}

export const liftImageFileURL = ({ contents = [], ...rest }) => {
    const tagsToLift = contents.filter(({ tag }) => (tag === 'Image'))
    const unliftedItems = contents.filter(({ tag }) => (tag !== 'Image'))
    const fileURL = tagsToLift.reduce((previous, { fileURL }) => (fileURL || previous), undefined)
    return {
        contents: unliftedItems,
        ...rest,
        fileURL
    }
}

export const liftPronounTags = ({ contents = [], ...rest}) => {
    const tagsToLift = contents.filter(({ tag }) => (tag === 'Pronouns'))
    const unliftedItems = contents.filter(({ tag }) => (tag !== 'Pronouns'))
    const Pronouns = tagsToLift.reduce((previous, { subject, object, possessive, adjective, reflexive }) => ({
        ...previous,
        subject,
        object,
        possessive,
        adjective,
        reflexive
    }), {
        subject: 'they',
        object: 'them',
        possessive: 'their',
        adjective: 'theirs',
        reflexive: 'themself'
    })
    return {
        contents: unliftedItems,
        ...rest,
        Pronouns
    }
}

export const discardContents = ({ contents = [], ...rest }) => ({ ...rest })

//
// validate is a wrapper that turns a function of the sort (node) => string[] returning error strings into
// a processFunction reducer suitable for wmlProcess
//
export const validate = (validationFunction) => (node) => {
    const errorStrings = validationFunction(node)
    if (errorStrings.length) {
        const { errors = [], ...rest } = node
        return {
            ...rest,
            errors: [
                ...errors,
                ...errorStrings
            ]
        }
    }
    return node
}

export const confirmRequiredProps = (requiredProperties) => ({ tag, props }) => {
    return requiredProperties
        .filter((prop) => (props[prop] === undefined || !(props[prop]?.key || props[prop]?.literal || props[prop]?.expression)))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} is a required property for ${tag} tags.`))
}

export const confirmKeyProps = (keyOnlyProperties) => ({ tag, props }) => {
    return keyOnlyProperties
        .filter((prop) => (props[prop] & !props[prop]?.key))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} must pass a key value for ${tag} tags.`))
}

export const confirmLiteralProps = (literalOnlyProperties) => ({ tag, props }) => {
    return literalOnlyProperties
        .filter((prop) => (props[prop] & !props[prop]?.literal))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} must pass a literal (not expression) value for ${tag} tags.`))
}

export const confirmExpressionProps = (expressionOnlyProperties) => ({ tag, props }) => {
    return expressionOnlyProperties
        .filter((prop) => (props[prop] & !props[prop]?.expression))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} must pass an expression (not literal) value for ${tag} tags.`))
}

export const wmlProcessUpNonRecursive = (processFunctions = []) => (node) => (
    processFunctions.reduce((previous, process) => (process(previous)), node)
)

export const wmlProcessUp = (processFunctions = []) => ({ contents = [], ...rest }) => {
    const newContents = contents.map(wmlProcessUp(processFunctions))
    return processFunctions.reduce((previous, process) => (process(previous)), { contents: newContents, ...rest })
}
