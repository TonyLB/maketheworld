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
export const changedCharactersInPlay = /* GraphQL */ `
  subscription ChangedCharactersInPlay {
    changedCharactersInPlay {
      CharacterId
      RoomId
      Connected
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
        Retired
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
