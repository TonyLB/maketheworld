const confirmRequiredProps = (tag, requiredProperties) => (node) => {
    const { props, contents } = node.dbSchema()
    const propErrors = requiredProperties.filter((prop) => (props[prop] === undefined))
    return {
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
        return confirmRequiredProps('Layer', ['key'])(node)
    },
    NameExpression(node) {
        return node.dbSchema()
    },
    WMLExpression(node) {
        return node.children.map((item) => item.dbSchema())
    }
}

exports.dbSchema = dbSchema