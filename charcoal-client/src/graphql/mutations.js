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
  mutation DisconnectCharacterInPlay($CharacterId: String!) {
    disconnectCharacterInPlay(CharacterId: $CharacterId) {
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
export const putRoomMessage = /* GraphQL */ `
  mutation PutRoomMessage(
    $RoomId: String!
    $Message: String!
    $MessageType: String
    $Title: String
    $FromCharacterId: String
    $MessageId: String
    $CreatedTime: Long
  ) {
    putRoomMessage(
      RoomId: $RoomId
      Message: $Message
      MessageType: $MessageType
      Title: $Title
      FromCharacterId: $FromCharacterId
      MessageId: $MessageId
      CreatedTime: $CreatedTime
    ) {
      MessageId
      CreatedTime
      Target
      Message
      RoomId
      CharacterId
      FromCharacterId
      ToCharacterId
      Recap
      ExpirationTime
      Type
      Title
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
      FromCharacterId
      ToCharacterId
      Recap
      ExpirationTime
      Type
      Title
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
        Grants {
          CharacterId
          Actions
          Roles
        }
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
        Grants {
          CharacterId
          Actions
          Roles
        }
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
        Grants {
          CharacterId
          Actions
          Roles
        }
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
