import { SchemaTaggedMessageLegalContents, SchemaLinkTag, SchemaStringTag, SchemaTaggedMessageIncomingContents, isSchemaWhitespace, isSchemaLineBreak, isSchemaLink, isSchemaString, isSchemaSpacer, isSchemaConditionTagDescriptionContext, isSchemaCondition, SchemaConditionTag, isSchemaBookmark, SchemaBookmarkTag, SchemaConditionTagDescriptionContext } from "./baseClasses";

//
// Fold whitespace into TaggedMessage legal contents by appending or prepending it to String values
//
export const translateTaggedMessageContents = (contents: SchemaTaggedMessageIncomingContents[]): SchemaTaggedMessageLegalContents[] => {
    let returnValue: SchemaTaggedMessageLegalContents[] = []
    let currentToken: SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaConditionTag | undefined
    contents.forEach((item) => {
        if (isSchemaWhitespace(item)) {
            if (currentToken) {
                if (isSchemaString(currentToken)) {
                    currentToken = {
                        ...currentToken,
                        value: `${currentToken.value.trimEnd()} `
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = {
                        tag: 'String',
                        value: ' '
                    }
                }
            }
        }
        if (isSchemaLineBreak(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
                currentToken = undefined
            }
            returnValue.push(item)
        }
        if (isSchemaSpacer(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
                currentToken = undefined
            }
            returnValue.push(item)
        }
        if (isSchemaString(item)) {
            if (currentToken) {
                if (isSchemaString(currentToken)) {
                    currentToken = {
                        ...currentToken,
                        value: `${currentToken.value}${item.value}`
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = { ...item }
                }
            }
            else {
                currentToken = { ...item }
            }
        }
        if (isSchemaCondition(item) && isSchemaConditionTagDescriptionContext(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = {
                ...item,
                contents: translateTaggedMessageContents(item.contents)
            } as SchemaConditionTagDescriptionContext
        }
        if (isSchemaLink(item) || isSchemaBookmark(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = { ...item }
        }
    })
    if (currentToken) {
        if (currentToken.tag === 'String') {
            if (currentToken.value.trimEnd()) {
                returnValue.push({
                    ...currentToken,
                    value: currentToken.value.trimEnd()
                })
            }
        }
        else if (isSchemaCondition(currentToken) && isSchemaConditionTagDescriptionContext(currentToken)) {
            returnValue.push({
                ...currentToken,
                contents: translateTaggedMessageContents(currentToken.contents)
            }  as SchemaConditionTagDescriptionContext)
        }
        else {
            returnValue.push(currentToken)
        }
    }
    return returnValue
}
