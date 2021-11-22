const confirmRequiredProps = (tag, requiredProperties) => (node) => {
    const { props, contents } = node.dbSchema()
    const propErrors = requiredProperties.filter((prop) => (props[prop] === undefined || !(props[prop]?.literal || props[prop]?.expression)))
    return {
        tag,
        props,
        contents,
        ...(propErrors.length > 0 ? { errors: propErrors.map((prop) => (`${prop[0].toUpperCase()}${prop.slice(1)} is a required property for ${tag} tags.`))} : {})
    }

}

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
        return confirmRequiredProps('Room', ['key'])(node)
    },
    LayerExpression(node) {
        const parsedProps = confirmRequiredProps('Layer', ['key'])(node)
        const { key = 'NO-KEY', ...otherProps } = parsedProps?.props ?? {}
        return {
            ...parsedProps,
            key,
            props: otherProps
        }
    },
    NameExpression(node) {
        return {
            ...node.dbSchema(),
            tag: 'Name'
        }
    },
    AssetExpression(node) {
        const parsedProps = confirmRequiredProps('Asset', ['key'])(node)
        const { key= { literal: 'NO-KEY' }, ...otherProps } = parsedProps?.props ?? {}
        return parsedProps.contents
            .reduce((previous, { tag, props, contents }) => {
                switch(tag) {
                    case 'Layer':
                        return {
                            ...previous,
                            layers: [
                                ...previous.layers,
                                {
                                    props,
                                    contents
                                }
                            ]
                        }
                    case 'Name':
                        return { ...previous, name: contents.join(' ') }
                    default:
                        return previous
                }
            }, {
                name: 'Untitled',
                key: key.literal,
                props: otherProps,
                layers: []
            })
    }
}

exports.dbSchema = dbSchema