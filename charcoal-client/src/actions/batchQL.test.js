import {
    extractMutation,
    populateMutationVariables,
    batchMutations
} from './batchQL'

const testMessageOne = /* GraphQL */ `
    mutation TestMessage(
        RoomId: String!
    ) {
        testMessage(
            RoomId: '123'
        ) {
            MessageId
            RoomId
        }
    }
`

const testMessageTwo = /* GraphQL */ `
mutation TestMessage(
    $RoomId: String!
) {
    testMessage(
        RoomId: $RoomId
    ) {
        MessageId
        RoomId
    }
}
`

const testMessageThree = /* GraphQL */ `
mutation TestMessage(
    $RoomId: String!
    $Room: String
) {
    testMessage(
        RoomId: $RoomId
        Room: $Room
    ) {
        MessageId
        RoomId
    }
}
`

describe('batchQL manipulators', () => {
    it('should extract a graphQL field', () => {
        expect(extractMutation(testMessageOne)).toEqual(
            `testMessage(\nRoomId: '123'\n) {\nMessageId\nRoomId\n}\n`
        )
    })

    it('should properly fill in variables in a batchQL template', () => {
        expect(populateMutationVariables({
                template: extractMutation(testMessageTwo),
                RoomId: '234'
            })).toEqual(
                `testMessage(\nRoomId: "234"\n) {\nMessageId\nRoomId\n}\n`
            )
    })

    it('should properly fill in variables when one variable is a substring of another', () => {
        expect(populateMutationVariables({
                template: extractMutation(testMessageThree),
                Room: 'Lobby',
                RoomId: '234'
            })).toEqual(
                `testMessage(\nRoomId: "234"\nRoom: "Lobby"\n) {\nMessageId\nRoomId\n}\n`
            )
    })

    it('should properly batch mutations', () => {
        const mutations = [
            populateMutationVariables({
                template: extractMutation(testMessageTwo),
                RoomId: '234'
            }),
            populateMutationVariables({
                template: extractMutation(testMessageTwo),
                RoomId: '345'
            }),
        ]
        expect(batchMutations(mutations)).toEqual(
                `mutation BatchMutation {\nField0: testMessage(\nRoomId: "234"\n) {\nMessageId\nRoomId\n}\nField1: testMessage(\nRoomId: "345"\n) {\nMessageId\nRoomId\n}\n}`
            )
    })
})
