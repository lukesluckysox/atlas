-- Collections (Pro-gated in API). Fully manual curation.
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Collection_userId_updatedAt_idx" ON "Collection"("userId", "updatedAt");

ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectionItem_collectionId_kind_refId_key"
  ON "CollectionItem"("collectionId", "kind", "refId");

CREATE INDEX "CollectionItem_collectionId_addedAt_idx"
  ON "CollectionItem"("collectionId", "addedAt");

ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
