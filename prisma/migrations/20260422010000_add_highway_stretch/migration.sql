-- CreateTable
CREATE TABLE "HighwayStretch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ref" TEXT,
    "category" TEXT,
    "startLabel" TEXT NOT NULL,
    "endLabel" TEXT NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "geometry" JSONB NOT NULL,
    "distanceMi" DOUBLE PRECISION NOT NULL,
    "drivenAt" TIMESTAMP(3),
    "drivenNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HighwayStretch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HighwayStretch_userId_idx" ON "HighwayStretch"("userId");

-- AddForeignKey
ALTER TABLE "HighwayStretch" ADD CONSTRAINT "HighwayStretch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
