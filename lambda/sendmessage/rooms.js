const { TABLE_PREFIX } = process.env;
const roomTable = `${TABLE_PREFIX}_rooms`

const getRoom = async ({ ddb, roomId }) => {
    return ddb.get({ TableName: roomTable, Key: { roomId } }).promise()
}

const putRoom = ({ ddb, roomData }) => {
    return ddb.put({ TableName: roomTable, Item: roomData }).promise()
}

exports.getRoom = getRoom
