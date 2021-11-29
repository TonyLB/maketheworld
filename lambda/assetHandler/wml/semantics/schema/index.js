const {
    desourceTag,
    confirmRequiredProps,
    wmlProcessUpNonRecursive,
    validate,
    liftLiteralProps,
    liftExpressionProps,
    liftBooleanProps,
    liftLiteralTags,
    liftUntagged,
    confirmExpressionProps,
    confirmLiteralProps
} = require('./processUp')

const fileNameValidator = ({ fileName = '' }) => (fileName?.match?.(/^[\w\d-\_]+$/) ? [] : [`FileName property of Asset must be composed exclusively of letters, numbers, '-' and '_'`])

const processTagProps = (tag, props) => ({
    tag,
    props: props.children
        .map((prop) => prop.schema())
        .reduce((previous, { argument, expression, literal }) => ({
            ...previous,
            [argument]: {
                expression,
                literal
            }
        }), {})
})

const schema = {
    //
    // TODO: Parse out string-internal white-space as needed
    //
    JSExpression(node) {
        return this.sourceString
    },
    stringText(node) {
        return this.sourceString
    },
    spaceCompressor(node) {
        return ' '
    },
    _iter(...nodes) {
        return nodes.map((node) => (node.schema())).join('')
    },
    tagArgValueQuoted(value, _) {
        return value.sourceString
    },
    TagArgumentBracketed(argument, openBracket, expression, closeBracket) {
        return {
            argument: argument.sourceString,
            expression: expression.schema()
        }
    },
    tagArgumentQuoted(argument, openQuote, literal) {
        return {
            argument: argument.sourceString,
            literal: literal.schema()
        }
    },
    tagBooleanArgument(argument, lookAhead) {
        return {
            argument: argument.sourceString,
            literal: true
        }
    },
    TagOpen(open, tag, props, close) {
        return processTagProps(tag, props)
    },
    TagSelfClosing(open, tag, props, close) {
        return processTagProps(tag, props)
    },
    TagExpression(open, contents, close) {
        return {
            ...open.schema(),
            contents: contents.children.map(item => item.schema())
        }
    },
    RoomExpression(node) {
        return wmlProcessUpNonRecursive([
            desourceTag,
            validate(confirmRequiredProps(['key'])),
            validate(confirmLiteralProps(['key'])),
            validate(({ display = 'replace' }) => (['replace', 'after', 'before'].includes(display) ? [] : [`"${display}" is not a valid value for property 'display' in Room"`])),
            liftLiteralProps(['key', 'display']),
            liftBooleanProps(['global']),
            liftLiteralTags({ Name: 'name' }),
            liftUntagged('render'),
        ])(node.schema())
    },
    ExitExpression(node) {
        return wmlProcessUpNonRecursive([
            desourceTag,
            validate(confirmLiteralProps(['key', 'to', 'from'])),
            liftLiteralProps(['key', 'to', 'from'])
        ])(node.schema())
    },
    LayerExpression(node) {
        return wmlProcessUpNonRecursive([
                desourceTag,
                validate(confirmLiteralProps(['key'])),
                liftLiteralProps(['key'])
            ])(node.schema())
    },
    ConditionExpression(node) {
        return wmlProcessUpNonRecursive([
                desourceTag,
                validate(confirmRequiredProps(['if'])),
                validate(confirmExpressionProps(['if'])),
                liftExpressionProps(['if'])
            ])(node.schema())
    },
    NameExpression(node) {
        return {
            ...node.schema(),
            tag: 'Name'
        }
    },
    AssetExpression(node) {
        return wmlProcessUpNonRecursive([
                desourceTag,
                validate(confirmRequiredProps(['key', 'fileName'])),
                validate(confirmLiteralProps(['key', 'fileName'])),
                liftLiteralProps(['key', 'fileName']),
                validate(fileNameValidator),
                liftLiteralTags({ Name: 'name' }),
                liftUntagged('description')
            ])(node.schema())
    }
}

exports.schema = schema
