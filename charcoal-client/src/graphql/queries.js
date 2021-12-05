/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getRoomRecap = /* GraphQL */ `
  query GetRoomRecap($PermanentId: String!) {
    getRoomRecap(PermanentId: $PermanentId) {
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
  }
`;
export const syncPermanents = /* GraphQL */ `
  query SyncPermanents(
    $limit: Int
    $exclusiveStartKey: ExclusiveStartKey
    $startingAt: Long
  ) {
    syncPermanents(
      limit: $limit
      exclusiveStartKey: $exclusiveStartKey
      startingAt: $startingAt
    ) {
      Items {
        Neighborhood {
          PermanentId
          Name
          Description
          ParentId
          Visibility
          Topology
          ContextMapId
          Retired
        }
        Room {
          PermanentId
          Name
          Description
          ParentId
          Visibility
          Topology
          Retired
        }
        Map {
          MapId
          Name
          Rooms {
            PermanentId
            X
            Y
            Locked
          }
        }
        Settings {
          ChatPrompt
        }
        Role {
          RoleId
          Name
          Actions
        }
        Backup {
          PermanentId
          Name
          Description
          Status
        }
        Character {
          PlayerName
          Name
          CharacterId
          Pronouns
          FirstImpression
          Outfit
          OneCoolThing
          HomeId
        }
        Exit {
          FromRoomId
          ToRoomId
          Name
          Delete
        }
      }
      LastSync
      LatestMoment
      LastEvaluatedKey {
        PermanentId
        DataCategory
      }
    }
  }
`;
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
