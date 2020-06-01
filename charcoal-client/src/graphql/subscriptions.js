/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const changedPlayer = /* GraphQL */ `
  subscription ChangedPlayer($PlayerName: String) {
    changedPlayer(PlayerName: $PlayerName) {
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
export const changedCharactersInPlay = /* GraphQL */ `
  subscription ChangedCharactersInPlay {
    changedCharactersInPlay {
      CharacterId
      RoomId
      ConnectionId
    }
  }
`;
export const changedPermanents = /* GraphQL */ `
  subscription ChangedPermanents {
    changedPermanents {
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
export const changedRoom = /* GraphQL */ `
  subscription ChangedRoom {
    changedRoom {
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
export const addedMessage = /* GraphQL */ `
  subscription AddedMessage($RoomId: String, $CharacterId: String) {
    addedMessage(RoomId: $RoomId, CharacterId: $CharacterId) {
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
export const changedRole = /* GraphQL */ `
  subscription ChangedRole {
    changedRole {
      RoleId
      Name
      Actions
    }
  }
`;
