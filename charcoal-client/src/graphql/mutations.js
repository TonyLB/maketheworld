/* eslint-disable */
// this is an auto generated file. This will be overwritten

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
      Exit {
        FromRoomId
        ToRoomId
        Name
        Delete
      }
    }
  }
`;
