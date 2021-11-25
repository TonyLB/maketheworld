const {
    desourceTag,
    confirmRequiredProps,
    wmlProcessUpNonRecursive,
    validate,
    liftLiteralProps,
    liftLiteralTags,
    liftUntagged
} = require('./processUp')

const fileNameValidator = ({ fileName = '' }) => (fileName?.match?.(/^[\w\d-\_]+$/) ? [] : [`FileName property of Asset must be composed exclusively of letters, numbers, '-' and '_'`])

const dbSchema = {
    //
    // TODO: Parse out string-internal white-space as needed
    //
    JSExpression(node) {
        return this.sourceString
    },
    string(node) {
        return this.sourceString
    },
    _iter(...nodes) {
        return nodes.map((node) => (node.dbSchema())).join('')
    },
    tagArgValueQuoted(value, _) {
        return value.sourceString
    },
    TagArgumentBracketed(argument, openBracket, expression, closeBracket) {
        return {
            argument: argument.sourceString,
            expression: expression.dbSchema()
        }
    },
    tagArgumentQuoted(argument, openQuote, literal) {
        return {
            argument: argument.sourceString,
            literal: literal.dbSchema()
        }
    },
    TagOpen(open, tag, props, close) {
        return {
            tag,
            props: props.children
                .map((prop) => prop.dbSchema())
                .reduce((previous, { argument, expression, literal }) => ({
                    ...previous,
                    [argument]: {
                        expression,
                        literal
                    }
                }), {})
        }
    },
    TagExpression(open, contents, close) {
        return {
            ...open.dbSchema(),
            contents: contents.children.map(item => item.dbSchema())
        }
    },
    RoomExpression(node) {
        return wmlProcessUpNonRecursive([
            desourceTag,
            validate(confirmRequiredProps(['key'])),
            validate(({ display = 'replace' }) => (['replace', 'after', 'before'].includes(display) ? [] : [`"${display}" is not a valid value for property 'display' in Room"`])),
            liftLiteralProps(['key', 'display']),
            liftLiteralTags({ Name: 'name' }),
            liftUntagged('render'),
        ])(node.dbSchema())
    },
    LayerExpression(node) {
        return wmlProcessUpNonRecursive([
                desourceTag,
                validate(confirmRequiredProps(['key'])),
                liftLiteralProps(['key'])
            ])(node.dbSchema())
    },
    NameExpression(node) {
        return {
            ...node.dbSchema(),
            tag: 'Name'
        }
    },
    AssetExpression(node) {
        return wmlProcessUpNonRecursive([
                desourceTag,
                validate(confirmRequiredProps(['key', 'fileName'])),
                liftLiteralProps(['key', 'fileName']),
                validate(fileNameValidator),
                liftLiteralTags({ Name: 'name' }),
                liftUntagged('description')
            ])(node.dbSchema())
    }
}

exports.dbSchema = dbSchema
