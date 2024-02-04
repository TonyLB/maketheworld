//
// Fold whitespace into TaggedMessage legal contents by appending or prepending it to String values

import { GenericTree, GenericTreeNode } from "../../../tree/baseClasses"
import { SchemaTag, isSchemaAfter, isSchemaBefore, isSchemaBookmark, isSchemaCondition, isSchemaLineBreak, isSchemaLink, isSchemaReplace, isSchemaSpacer, isSchemaString, isSchemaTaggedMessageLegalContents, isSchemaWhitespace } from "../../baseClasses"

//
export const translateTaggedMessageContents = (contents: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    let returnValue: GenericTree<SchemaTag> = []
    let currentToken: GenericTreeNode<SchemaTag> | undefined
    contents.forEach((item) => {
        if (isSchemaWhitespace(item.data)) {
            if (currentToken) {
                if (isSchemaString(currentToken?.data)) {
                    currentToken = {
                        ...currentToken,
                        data: {
                            ...currentToken.data,
                            value: `${currentToken.data.value.trimEnd()} `
                        }
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = {
                        data: {
                            tag: 'String',
                            value: ' '
                        },
                        children: []
                    }
                }
            }
        }
        if (isSchemaLineBreak(item.data) || isSchemaSpacer(item.data) || isSchemaLink(item.data) || isSchemaBookmark(item.data)) {
            if (currentToken) {
                returnValue.push(currentToken)
                currentToken = undefined
            }
            returnValue.push({ data: item.data, children: [] })
        }
        if (isSchemaString(item.data)) {
            if (currentToken) {
                if (isSchemaString(currentToken.data)) {
                    currentToken = {
                        ...currentToken,
                        data: {
                            ...currentToken.data,
                            value: `${currentToken.data.value}${item.data.value}`
                        }
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = { data: item.data, children: [] }
                }
            }
            else {
                currentToken = { data: item.data, children: [] }
            }
        }
        if (isSchemaCondition(item.data) || isSchemaAfter(item.data) || isSchemaBefore(item.data) || isSchemaReplace(item.data)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = {
                data: item.data,
                children: translateTaggedMessageContents(item.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data))))
            }
        }
    })
    if (currentToken) {
        if (isSchemaString(currentToken.data)) {
            if (currentToken.data.value.trimEnd()) {
                returnValue.push({
                    data: {
                        ...currentToken.data,
                        value: currentToken.data.value.trimEnd()
                    },
                    children: translateTaggedMessageContents(currentToken.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data))))
                })
            }
        }
        else {
            returnValue.push({
                ...currentToken,
                children: translateTaggedMessageContents(currentToken.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data))))
            })
        }
    }
    return returnValue
}
