const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient, } = require('../utilities')

const AWSXRay = require('aws-xray-sdk')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')

const { permanentAndDeltas } = require('../delta')

//
// TODO: When all putCharacter functionality is guaranteed lifted to the
// ControlChannel, remove this module
//
exports.putCharacter = async ({
    CharacterId: passedCharacterId,
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    HomeId,
    Player
}) => {

    const lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient({ region: process.env.AWS_REGION }))
    const CharacterId = passedCharacterId || uuidv4()

    try {
        const writes = await permanentAndDeltas({
            PutRequest: {
                Item: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Details',
                    Name,
                    Pronouns,
                    FirstImpression,
                    OneCoolThing,
                    Outfit,
                    HomeId,
                    Player
                }
            }
        })

        await Promise.all([
            documentClient.batchWrite({ RequestItems: writes }).promise(),
            lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.EPHEMERA_SERVICE,
                Payload: new TextEncoder().encode(JSON.stringify({
                    action: 'denormalize',
                    PermanentId: `CHARACTER#${CharacterId}`,
                    data: {
                        Pronouns,
                        FirstImpression,
                        OneCoolThing,
                        Outfit,
                        Name
                    }
                }))
            }))
        ])
        return [{
            Character: {
                CharacterId,
                Name,
                Pronouns,
                FirstImpression,
                OneCoolThing,
                Outfit,
                HomeId
            }
        }]

    }
    catch (err) {
        console.log(err)
        return { error: err.stack }
    }

}