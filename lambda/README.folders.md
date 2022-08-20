---
---

# Asset Folder Structure

Asset Files are organized into folders in three distinct zones, to represent how they are used
differently by the system

---

## Needs Addressed

---

***Organizing Assets***
- Creators need to be able to organize their assets relative to each other and thematically
group them

***Canonical Assets***
- The system needs to tag some assets as being universally available to all players, without
needing to be granted special permission or be involved in a story

***Library Assets***
- The system needs to tag some assets as shared, but not universally available.  These assets
should only appear to characters that are either granted special access, or involved in a story
that imports or instantiates the assets

***Personal Assets***
- The system needs to tag some assets as personal to either a character or a player.  These
assets should appear only to the relevant characters, and anyone those characters give short-term
access to (usually by creating a story that references the personal asset and inviting people
into it)

***Movement between zones***
- The system needs to be able to move assets from one zone to another (e.g. checking in a
personal asset to the library so others may share it) without having to rewrite the internal
structure of the files.

---

## Folder Structure

---

The **asset** S3 bucket has three top-level sub-folders:
    - Canon
    - Library
    - Personal

Objects stored in the Canon sub-folder are accessible to all characters.  They can be stored within
further sub-folders are part of the **asset** lambda API calls that create the asset.

Objects stored in the Library sub-folder are publically shared, but do not automatically appear
to all characters.  Players can examine and reference them in the asset-creation functions, and
can associate them with stories.  The contents are rendered for a character who is a participant in
a story that references it.  The S3 objects can be stored within further sub-folders are part of
the **asset** lambda API calls that create the asset.

Objects stored in the Personal sub-folder are accessible to one particular player, and the first sub-folder
is named with the userName of that player.  These objects can be stored within further sub-folders are part
of the **asset** lambda API calls that create the asset.

---
---