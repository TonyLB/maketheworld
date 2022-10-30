import { SchemaTaggedMessageLegalContents, SchemaLinkTag, SchemaStringTag, SchemaTaggedMessageIncomingContents, isSchemaWhitespace, isSchemaLineBreak, isSchemaLink, isSchemaString, isSchemaSpacer, isSchemaConditionTagDescriptionContext, isSchemaCondition, SchemaConditionTag } from "./baseClasses";

//
// TODO: This may (with new refinements) be so simple as to barely need any real code ... refactor
//
export const translateTaggedMessageContents = (contents: SchemaTaggedMessageIncomingContents[]): SchemaTaggedMessageLegalContents[] => {
    let returnValue: SchemaTaggedMessageLegalContents[] = []
    let currentToken: SchemaStringTag | SchemaLinkTag | SchemaConditionTag | undefined
    contents.forEach((item) => {
        if (isSchemaWhitespace(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
                currentToken = undefined
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
        if (isSchemaLink(item) || isSchemaString(item) || isSchemaCondition(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = { ...item }
        }
    })
    if (currentToken) {
        returnValue.push(currentToken)
    }
    return returnValue
}
