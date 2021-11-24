const { confirmRequiredProps, aggregateErrors, wmlProcess, validate } = require('./processing')

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
        return confirmRequiredProps(['key'], ['key'])(node.dbSchema())
    },
    LayerExpression(node) {
        return confirmRequiredProps(['key'], ['key'])(node.dbSchema())
    },
    NameExpression(node) {
        return {
            ...node.dbSchema(),
            tag: 'Name'
        }
    },
    AssetExpression(node) {
        const parsedProps = wmlProcess([
                confirmRequiredProps(['key', 'fileName'], ['key', 'fileName']),
                validate(fileNameValidator),
                aggregateErrors
            ])(node)
        const consolidate = (previous) => ({ layers = [], ...rest }) => ({
            ...previous,
            layers: [
                ...previous.layers,
                ...layers
            ],
            ...rest
        })
        const { contents, ...otherProps } = parsedProps
        return parsedProps.contents
            .reduce((previous, { tag, ...rest }) => {
                switch(tag) {
                    case 'Layer':
                        return consolidate(previous)({ layers: [rest] })
                    case 'Name':
                        return consolidate(previous)({ name: rest.contents.join(' ') })
                    default:
                        return previous
                }
            }, {
                name: 'Untitled',
                layers: [],
                ...otherProps
            })
    }
}

exports.dbSchema = dbSchema