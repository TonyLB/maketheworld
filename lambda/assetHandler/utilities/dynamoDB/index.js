const { GetItemCommand, PutItemCommand, QueryCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { v4: uuidv4 } = require("uuid")

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const batchWriteDispatcher = (dbClient, { table, items }) => {
    const groupBatches = items
        .reduce((({ current, requestLists }, item) => {
            if (current.length > 19) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .filter((itemList) => (itemList.length))
        .map((itemList) => (dbClient.send(new BatchWriteItemCommand({ RequestItems: {
            [table]: itemList
        } }))))
    return Promise.all(batchPromises)
}

//
// TODO:  Error handling to respond if the DynamoDB service throws an error
//
const replaceItem = async (dbClient, item) => {
    const putItem = new PutItemCommand({
        TableName: permanentsTable,
        Item: marshall(item, { removeUndefinedValues: true })
    })
    await dbClient.send(putItem)
}

const replaceRangeByDataCategory = async (dbClient, DataCategory, items, equalityFunction) => {
    const query = new QueryCommand({
        TableName: permanentsTable,
        KeyConditionExpression: "DataCategory = :dc",
        ExpressionAttributeValues: marshall({ ":dc": DataCategory }),
        IndexName: 'DataCategoryIndex'
    })
    const { Items: currentItems = [] } = await dbClient.send(query)
    const currentItemsByPermanentId = currentItems.map(unmarshall).reduce((previous, { PermanentId, ...rest }) => ({ ...previous, [PermanentId]: { PermanentId, ...rest }}), {})
    const scopedToPermanent = currentItems.map(unmarshall).filter(({ scopedId }) => (scopedId)).reduce((previous, { scopedId, PermanentId }) => ({ ...previous, [scopedId]: PermanentId }), {})
    //
    // Use a quick mutable map to track state as we combine several array
    // conditions
    //
    let stateByPermanentId = Object.values(currentItemsByPermanentId).reduce(
        (previous, { PermanentId }) => ({
            ...previous,
            [PermanentId]: {
                DeleteRequest: {
                    Key: marshall({ PermanentId, DataCategory })
                }
            }
        }), {})
    items.forEach((item) => {
        const { key, isGlobal, ...rest } = item
        const targetPermanentId = isGlobal ? `ROOM#${key}` : scopedToPermanent[key]
        if (targetPermanentId && equalityFunction(currentItemsByPermanentId?.[targetPermanentId] ?? {}, { PermanentId: targetPermanentId, scopedId: key, ...rest })) {
            stateByPermanentId[targetPermanentId] = 'ignore'
        }
        else {
            const newPermanentId = targetPermanentId || `ROOM#${uuidv4()}`
            stateByPermanentId[newPermanentId] = {
                PutRequest: {
                    Item: marshall({
                        DataCategory,
                        PermanentId: newPermanentId,
                        scopedId: key,
                        ...rest
                    }, { removeUndefinedValues: true })
                }
            }
        }
    })

    await batchWriteDispatcher(dbClient, {
        table: permanentsTable,
        items: Object.values(stateByPermanentId).filter((value) => (value !== 'ignore'))
    })
}

exports.replaceItem = replaceItem
exports.replaceRangeByDataCategory = replaceRangeByDataCategory
