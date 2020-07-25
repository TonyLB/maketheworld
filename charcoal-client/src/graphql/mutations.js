/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const putPlayer = /* GraphQL */ `
  mutation PutPlayer(
    $PlayerName: String
    $CodeOfConductConsent: Boolean
    $Characters: [String]
  ) {
    putPlayer(
      PlayerName: $PlayerName
      CodeOfConductConsent: $CodeOfConductConsent
      Characters: $Characters
    ) {
      Type
      PlayerName
      PlayerInfo {
        PlayerName
        CodeOfConductConsent
        Characters
      }
      CharacterInfo {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
        HomeId
      }
      GrantInfo {
        CharacterId
        Resource
        Actions
        Roles
        Revoke
      }
    }
  }
`;
export const addCharacterInPlay = /* GraphQL */ `
  mutation AddCharacterInPlay($CharacterId: String!) {
    addCharacterInPlay(CharacterId: $CharacterId) {
      CharacterId
      RoomId
      Connected
    }
  }
`;
export const deleteCharacterInPlay = /* GraphQL */ `
  mutation DeleteCharacterInPlay($CharacterId: String!) {
    deleteCharacterInPlay(CharacterId: $CharacterId) {
      CharacterId
      RoomId
      Connected
    }
  }
`;
export const disconnectCharacterInPlay = /* GraphQL */ `
  mutation DisconnectCharacterInPlay(
    $CharacterId: String!
    $ConnectionId: String!
  ) {
    disconnectCharacterInPlay(
      CharacterId: $CharacterId
      ConnectionId: $ConnectionId
    ) {
      CharacterId
      RoomId
      Connected
    }
  }
`;
export const moveCharacter = /* GraphQL */ `
  mutation MoveCharacter($CharacterId: String!, $RoomId: String!) {
    moveCharacter(CharacterId: $CharacterId, RoomId: $RoomId) {
      CharacterId
      RoomId
      Connected
    }
  }
`;
export const putDirectMessage = /* GraphQL */ `
  mutation PutDirectMessage(
    $CharacterId: String!
    $Message: String!
    $FromCharacterId: String!
    $ToCharacterId: String!
    $MessageId: String
    $CreatedTime: Long
  ) {
    putDirectMessage(
      CharacterId: $CharacterId
      Message: $Message
      FromCharacterId: $FromCharacterId
      ToCharacterId: $ToCharacterId
      MessageId: $MessageId
      CreatedTime: $CreatedTime
    ) {
      MessageId
      CreatedTime
      Target
      Message
      RoomId
      CharacterId
      DisplayProtocol
      Title
      ExpirationTime
      Recipients
    }
  }
`;
export const updateMessages = /* GraphQL */ `
  mutation UpdateMessages($Updates: [MessageUpdateInput]) {
    updateMessages(Updates: $Updates)
  }
`;
export const broadcastMessage = /* GraphQL */ `
  mutation BroadcastMessage($Message: MessageInput) {
    broadcastMessage(Message: $Message) {
      MessageId
      CreatedTime
      Target
      Message
      RoomId
      CharacterId
      DisplayProtocol
      Title
      ExpirationTime
      Recipients
    }
  }
`;
export const createBackup = /* GraphQL */ `
  mutation CreateBackup(
    $PermanentId: String
    $Name: String
    $Description: String
  ) {
    createBackup(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
    ) {
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
      Grant {
        CharacterId
        Resource
        Actions
        Roles
        Revoke
      }
      Exit {
        FromRoomId
        ToRoomId
        Name
        Delete
      }
    }
  }
`;
export const restoreBackup = /* GraphQL */ `
  mutation RestoreBackup($PermanentId: String) {
    restoreBackup(PermanentId: $PermanentId) {
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
      Grant {
        CharacterId
        Resource
        Actions
        Roles
        Revoke
      }
      Exit {
        FromRoomId
        ToRoomId
        Name
        Delete
      }
    }
  }
`;
export const updatePermanents = /* GraphQL */ `
  mutation UpdatePermanents($Updates: [PermanentInput]) {
    updatePermanents(Updates: $Updates) {
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
      Grant {
        CharacterId
        Resource
        Actions
        Roles
        Revoke
      }
      Exit {
        FromRoomId
        ToRoomId
        Name
        Delete
      }
    }
  }
`;
