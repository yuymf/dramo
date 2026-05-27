BEGIN;

-- Migrate Character3ViewAsset (V1) → CharacterAsset (V2)
-- V1 has: id, projectId, characterName, front, side, back (three view URLs)
-- V2 has: id, projectId, name, description, alias, images (JSON array of {url, viewType})
-- We create one CharacterAsset per V1 row with all three views packed into images JSON

INSERT INTO "CharacterAsset" (id, "projectId", name, description, images, "createdAt")
SELECT
  concat('migrated_', id),
  "projectId",
  "characterName",
  NULL,
  json_build_array(
    json_build_object('url', front, 'viewType', 'front'),
    json_build_object('url', side, 'viewType', 'side'),
    json_build_object('url', back, 'viewType', 'back')
  ),
  "createdAt"
FROM "Character3ViewAsset"
ON CONFLICT DO NOTHING;

-- Migrate LocationImageAsset (V1) → LocationAsset (V2)
-- V1 has: id, projectId, locationName, image (single URL)
-- V2 has: id, projectId, name, description, images (JSON array of {url})

INSERT INTO "LocationAsset" (id, "projectId", name, description, images, "createdAt")
SELECT
  concat('migrated_', id),
  "projectId",
  "locationName",
  NULL,
  json_build_array(json_build_object('url', image)),
  "createdAt"
FROM "LocationImageAsset"
ON CONFLICT DO NOTHING;

COMMIT;
