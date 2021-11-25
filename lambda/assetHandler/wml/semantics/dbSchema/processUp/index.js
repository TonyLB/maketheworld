//
// confirmRequiredProps scans the node structure directly in dbSchema conversion of a
// type that wraps TagExpression, and checks its tag-opening properties for required
// keys.  It also lifts some literal props (which will, by syntax, not need evaluation)
// out of the props object to top-level properties.
//
// Arguments of first currying:
//    requiredProperties:  A list of strings corresponding to property keys
//    liftLiteralProps: A list of strings corresponding to literal property keys
//
// Arguments of second currying:
//    node:  The return-value of node.dbSchema executed upon a TagExpression node:
//      { tag, props, contents, errors }
//    NOTE:  By syntax, the 'tag' value should always correspond to the tag element
//       of the chosen syntactic rule
//

const confirmRequiredProps = (requiredProperties, liftLiteralProps = []) => ({ tag, props, contents, errors = [] }) => {
    const propErrors = requiredProperties
        .filter((prop) => (props[prop] === undefined || !(props[prop]?.literal || props[prop]?.expression)))
        .map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} is a required property for ${tag.sourceString} tags.`))
    return {
        tag: tag.sourceString,
        //
        // Lift the specified literal props out of their structure to this level
        //
        ...(liftLiteralProps.reduce((previous, key) => ({ ...previous, [key]: props?.[key]?.literal }), {})),
        //
        // Pass on the props that aren't lifted in their more complex structure
        //
        props: Object.entries(props).filter(([key]) => (!liftLiteralProps.includes(key))).reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {}),
        contents,
        errors: [...propErrors, ...errors]
    }

}

const aggregateErrors = ({ contents = [], errors = [], ...rest }) => ({
    contents,
    errors: contents.reduce((previous, { errors = [] }) => ([...previous, ...errors]), errors),
    ...rest
})

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
        const { errors, ...rest } = node
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

const wmlProcessUpNonRecursive = (processFunctions = []) => (node) => (
    processFunctions.reduce((previous, process) => (process(previous)), node)
)

const wmlProcessUp = (processFunctions = []) => ({ contents = [], ...rest }) => {
    const newContents = contents.map(wmlProcessUp(processFunctions))
    return processFunctions.reduce((previous, process) => (process(previous)), { contents: newContents, ...rest })
}

exports.confirmRequiredProps = confirmRequiredProps
exports.aggregateErrors = aggregateErrors
exports.validate = validate
exports.liftLiteralTags = liftLiteralTags
exports.liftUntagged = liftUntagged
exports.wmlProcessUpNonRecursive = wmlProcessUpNonRecursive
exports.wmlProcessUp = wmlProcessUp
