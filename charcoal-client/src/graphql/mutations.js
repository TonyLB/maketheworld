/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const putPlayer = /* GraphQL */ `
  mutation PutPlayer($PlayerName: String, $CodeOfConductConsent: Boolean) {
    putPlayer(
      PlayerName: $PlayerName
      CodeOfConductConsent: $CodeOfConductConsent
    ) {
      Type
      PlayerName
      PlayerInfo {
        PlayerName
        CodeOfConductConsent
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
        Grants {
          Resource
          Actions
          Roles
        }
      }
      GrantInfo {
        CharacterId
        Resource
        Actions
        Roles
      }
    }
  }
`;
export const putCharacter = /* GraphQL */ `
  mutation PutCharacter(
    $Name: String!
    $CharacterId: String
    $Pronouns: String
    $FirstImpression: String
    $Outfit: String
    $OneCoolThing: String
    $HomeId: String
  ) {
    putCharacter(
      Name: $Name
      CharacterId: $CharacterId
      Pronouns: $Pronouns
      FirstImpression: $FirstImpression
      Outfit: $Outfit
      OneCoolThing: $OneCoolThing
      HomeId: $HomeId
    ) {
      Type
      PlayerName
      PlayerInfo {
        PlayerName
        CodeOfConductConsent
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
        Grants {
          Resource
          Actions
          Roles
        }
      }
      GrantInfo {
        CharacterId
        Resource
        Actions
        Roles
      }
    }
  }
`;
export const addCharacterInPlay = /* GraphQL */ `
  mutation AddCharacterInPlay($CharacterId: String!, $ConnectionId: String!) {
    addCharacterInPlay(CharacterId: $CharacterId, ConnectionId: $ConnectionId) {
      CharacterId
      RoomId
      ConnectionId
    }
  }
`;
export const deleteCharacterInPlay = /* GraphQL */ `
  mutation DeleteCharacterInPlay($ConnectionId: String!) {
    deleteCharacterInPlay(ConnectionId: $ConnectionId) {
      CharacterId
      RoomId
      ConnectionId
    }
  }
`;
export const moveCharacter = /* GraphQL */ `
  mutation MoveCharacter($CharacterId: String!, $RoomId: String!) {
    moveCharacter(CharacterId: $CharacterId, RoomId: $RoomId) {
      CharacterId
      RoomId
      ConnectionId
    }
  }
`;
export const putNeighborhood = /* GraphQL */ `
  mutation PutNeighborhood(
    $CharacterId: String!
    $PermanentId: String
    $Name: String!
    $Description: String
    $ParentId: String
    $Visibility: String
    $Topology: String
    $ContextMapId: String
    $Grants: [ResourceGrantInput]
  ) {
    putNeighborhood(
      CharacterId: $CharacterId
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
      Topology: $Topology
      ContextMapId: $ContextMapId
      Grants: $Grants
    ) {
      Neighborhood {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        ContextMapId
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
      }
    }
  }
`;
export const externalPutNeighborhood = /* GraphQL */ `
  mutation ExternalPutNeighborhood(
    $PermanentId: String!
    $Name: String!
    $Description: String
    $ParentId: String
    $Visibility: String
    $Topology: String
    $ContextMapId: String
    $Grants: [ResourceGrantInput]
  ) {
    externalPutNeighborhood(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
      Topology: $Topology
      ContextMapId: $ContextMapId
      Grants: $Grants
    ) {
      Neighborhood {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        ContextMapId
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
      }
    }
  }
`;
export const putRoom = /* GraphQL */ `
  mutation PutRoom(
    $PermanentId: String
    $Name: String!
    $Description: String
    $ParentId: String
    $Visibility: String
    $Topology: String
    $Exits: [PathInput]
    $Entries: [PathInput]
  ) {
    putRoom(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
      Topology: $Topology
      Exits: $Exits
      Entries: $Entries
    ) {
      PermanentId
      Name
      Description
      ParentId
      Visibility
      Topology
      Exits {
        Name
        RoomId
      }
      Entries {
        Name
        RoomId
      }
      Grants {
        CharacterId
        Actions
        Roles
      }
    }
  }
`;
export const externalPutRoom = /* GraphQL */ `
  mutation ExternalPutRoom(
    $PermanentId: String!
    $Name: String!
    $Description: String
    $ParentId: String
    $Visibility: String
    $Topology: String
  ) {
    externalPutRoom(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
      Topology: $Topology
    ) {
      Neighborhood {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        ContextMapId
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
      }
    }
  }
`;
export const externalUpdateGrant = /* GraphQL */ `
  mutation ExternalUpdateGrant(
    $PlayerName: String!
    $CharacterId: String!
    $Type: String!
    $Grant: ExternalGrantInput!
  ) {
    externalUpdateGrant(
      PlayerName: $PlayerName
      CharacterId: $CharacterId
      Type: $Type
      Grant: $Grant
    ) {
      Type
      PlayerName
      PlayerInfo {
        PlayerName
        CodeOfConductConsent
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
        Grants {
          Resource
          Actions
          Roles
        }
      }
      GrantInfo {
        CharacterId
        Resource
        Actions
        Roles
      }
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
export const putRole = /* GraphQL */ `
  mutation PutRole($RoleId: String!, $Name: String!, $Actions: String!) {
    putRole(RoleId: $RoleId, Name: $Name, Actions: $Actions) {
      RoleId
      Name
      Actions
    }
  }
`;
export const putMap = /* GraphQL */ `
  mutation PutMap($MapId: String, $Name: String!, $Rooms: [MapRoomInput]) {
    putMap(MapId: $MapId, Name: $Name, Rooms: $Rooms) {
      Neighborhood {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        ContextMapId
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
      }
    }
  }
`;
export const putSettings = /* GraphQL */ `
  mutation PutSettings($ChatPrompt: String) {
    putSettings(ChatPrompt: $ChatPrompt) {
      Neighborhood {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        ContextMapId
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
      }
    }
  }
`;
export const putBackup = /* GraphQL */ `
  mutation PutBackup(
    $PermanentId: String
    $Name: String
    $Description: String
    $Status: String
  ) {
    putBackup(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      Status: $Status
    ) {
      Neighborhood {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        ContextMapId
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
      }
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
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
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
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      Room {
        PermanentId
        Name
        Description
        ParentId
        Visibility
        Topology
        Exits {
          Name
          RoomId
        }
        Entries {
          Name
          RoomId
        }
        Grants {
          CharacterId
          Actions
          Roles
        }
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
      Backup {
        PermanentId
        Name
        Description
        Status
      }
    }
  }
`;
