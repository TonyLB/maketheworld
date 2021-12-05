/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const syncMessages = /* GraphQL */ `
  query SyncMessages(
    $targetId: String
    $limit: Int
    $exclusiveStartKey: MessageExclusiveStartKey
    $startingAt: Long
  ) {
    syncMessages(
      targetId: $targetId
      limit: $limit
      exclusiveStartKey: $exclusiveStartKey
      startingAt: $startingAt
    ) {
      Items {
        MessageId
        CreatedTime
        ExpirationTime
        DisplayProtocol
        Target
        RoomId
        WorldMessage {
          Message
        }
        CharacterMessage {
          Message
          CharacterId
        }
        DirectMessage {
          Message
          CharacterId
          Title
          Recipients
        }
        AnnounceMessage {
          Message
          Title
        }
        RoomDescription {
          RoomId
          Name
          Description
          Ancestry
          Exits {
            RoomId
            Name
            Visibility
          }
          Characters {
            CharacterId
            Name
            Pronouns
            FirstImpression
            OneCoolThing
            Outfit
          }
        }
      }
      LastEvaluatedKey {
        MessageId
        DataCategory
        CreatedTime
      }
      LastSync
    }
  }
`;
