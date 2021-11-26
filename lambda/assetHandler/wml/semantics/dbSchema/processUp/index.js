const aggregateErrors = ({ contents = [], errors = [], ...rest }) => ({
    contents,
    errors: contents.reduce((previous, { errors = [] }) => ([...previous, ...errors]), errors),
    ...rest
})

const desourceTag = ({ tag, ...rest }) => ({ tag: tag.sourceString, ...rest })

const liftLiteralProps = (liftLiteralProps = []) => ({ props, ...rest }) => {
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

const liftExpressionProps = (liftExpressionProps = []) => ({ props, ...rest }) => {
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

const liftLiteralTags = (tagsMap) => ({ contents = [], ...rest}) => {
    const tags = Object.keys(tagsMap)
    const tagsToLift = contents.filter(({ tag }) => (tags.includes(tag)))
    const unliftedItems = contents.filter(({ tag }) => (!tags.includes(tag)))
    const tagOutcomes = tagsToLift.reduce((previous, { tag, contents }) => ({
        ...previous,
        [tagsMap[tag]]: contents.join(' ')
    }), {})
    return {
        contents: unliftedItems,
        ...rest,
        ...tagOutcomes
    }
}

const liftUntagged = (label) => ({ contents = [], ...rest }) => {
    const itemsToLift = contents.filter(({ tag }) => (!tag))
    const unliftedTags = contents.filter(({ tag }) => (tag))
    const aggregation = (items) => (items.join(''))
    return {
        contents: unliftedTags,
        ...rest,
        [label]: aggregation(itemsToLift)
    }
    
}

//
// validate is a wrapper that turns a function of the sort (node) => string[] returning error strings into
// a processFunction reducer suitable for wmlProcess
//
const validate = (validationFunction) => (node) => {
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

const confirmRequiredProps = (requiredProperties) => ({ tag, props }) => {
    return requiredProperties
        .filter((prop) => (props[prop] === undefined || !(props[prop]?.literal || props[prop]?.expression)))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} is a required property for ${tag.sourceString} tags.`))
}

const confirmLiteralProps = (literalOnlyProperties) => ({ tag, props }) => {
    return literalOnlyProperties
        .filter((prop) => (props[prop] & !props[prop]?.literal))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} must pass a literal (not expression) value for ${tag.sourceString} tags.`))
}

const confirmExpressionProps = (expressionOnlyProperties) => ({ tag, props }) => {
    return expressionOnlyProperties
        .filter((prop) => (props[prop] & !props[prop]?.expression))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} must pass an expression (not literal) value for ${tag.sourceString} tags.`))
}

const wmlProcessUpNonRecursive = (processFunctions = []) => (node) => (
    processFunctions.reduce((previous, process) => (process(previous)), node)
)

const wmlProcessUp = (processFunctions = []) => ({ contents = [], ...rest }) => {
    const newContents = contents.map(wmlProcessUp(processFunctions))
    return processFunctions.reduce((previous, process) => (process(previous)), { contents: newContents, ...rest })
}

exports.desourceTag = desourceTag
exports.confirmRequiredProps = confirmRequiredProps
exports.confirmLiteralProps = confirmLiteralProps
exports.confirmExpressionProps = confirmExpressionProps
exports.aggregateErrors = aggregateErrors
exports.validate = validate
exports.liftLiteralProps = liftLiteralProps
exports.liftExpressionProps = liftExpressionProps
exports.liftLiteralTags = liftLiteralTags
exports.liftUntagged = liftUntagged
exports.wmlProcessUpNonRecursive = wmlProcessUpNonRecursive
exports.wmlProcessUp = wmlProcessUp
