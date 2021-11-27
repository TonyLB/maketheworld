const { GetItemCommand, PutItemCommand, QueryCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")

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
    //
    // Use a quick mutable map to track state as we combine several array
    // conditions
    //
    let stateByPermanentId = Object.keys(currentItemsByPermanentId).reduce(
        (previous, PermanentId) => ({
            ...previous,
            [PermanentId]: {
                DeleteRequest: {
                    Key: marshall({ PermanentId, DataCategory })
                }
            }
        }), {})
    items.forEach((item) => {
        const { PermanentId } = item
        if (PermanentId) {
            if (equalityFunction(currentItemsByPermanentId?.[PermanentId] ?? {}, item)) {
                stateByPermanentId[PermanentId] = 'ignore'
            }
            else {
                stateByPermanentId[PermanentId] = {
                    PutRequest: {
                        Item: marshall({
                            DataCategory,
                            ...item
                        }, { removeUndefinedValues: true })
                    }
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
