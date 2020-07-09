const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`
const deltaTable = `${TABLE_PREFIX}_permanent_delta`

const permanentAndDeltas = async ({ PutRequest, DeleteRequest }) => {
    const { PermanentId, DataCategory, ...rest } = PutRequest
        ? PutRequest.Item || {}
        : DeleteRequest.Key || {}
    const previousDeltas = await documentClient.query({
        TableName: deltaTable,
        IndexName: 'RowIdIndex',
        KeyConditionExpression: "RowId = :RowId",
        ExpressionAttributeValues: {
            ":RowId": `${PermanentId}::${DataCategory}`
        }
    }).promise()
        .then(({ Items = [] }) => Items)

    const epochTime = Date.now()

    return {
        [permanentTable]: [ PutRequest ? { PutRequest } : { DeleteRequest } ],
        [deltaTable]: [
            ...(previousDeltas.map(({ PartitionId, DeltaId }) => ({
                DeleteRequest: {
                    Key: {
                        PartitionId,
                        DeltaId
                    }
                }
            }))),
            {
                PutRequest: {
                    Item: {
                        PartitionId: Math.floor(epochTime / 10000000),
                        DeltaId: `${epochTime}::${PermanentId}::${DataCategory}`,
                        RowId: `${PermanentId}::${DataCategory}`,
                        ...( PutRequest ? rest : { Delete: true })
                    }
                }
            }
        ]
    }
}

exports.permanentAndDeltas = permanentAndDeltas
