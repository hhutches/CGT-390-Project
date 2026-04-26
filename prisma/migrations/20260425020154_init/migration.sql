-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'SHOW', 'ALBUM', 'GAME', 'BOOK');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('WISHLIST', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'DROPPED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ProfilePrivacy" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "LogEventType" AS ENUM ('ADDED', 'STARTED', 'COMPLETED', 'RATED', 'REVIEWED', 'REWATCHED', 'UPDATED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('TMDB', 'GOOGLE_BOOKS', 'MUSICBRAINZ', 'SPOTIFY', 'IGDB', 'MANUAL');

-- CreateEnum
CREATE TYPE "BlobPurpose" AS ENUM ('AVATAR', 'BANNER', 'MEDIA_COVER', 'REVIEW_IMAGE', 'OTHER');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "privacy" "ProfilePrivacy" NOT NULL DEFAULT 'PUBLIC',
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "avatarBlobId" INTEGER,
    "bannerBlobId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlobAsset" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "purpose" "BlobPurpose" NOT NULL DEFAULT 'OTHER',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" SERIAL NOT NULL,
    "type" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "description" TEXT,
    "releaseDate" TIMESTAMP(3),
    "coverUrl" TEXT,
    "backdropUrl" TEXT,
    "languageCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieDetails" (
    "mediaId" INTEGER NOT NULL,
    "runtimeMinutes" INTEGER,

    CONSTRAINT "MovieDetails_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "ShowDetails" (
    "mediaId" INTEGER NOT NULL,
    "seasonsCount" INTEGER,
    "episodesCount" INTEGER,
    "avgRuntimeMinutes" INTEGER,
    "showStatus" TEXT,

    CONSTRAINT "ShowDetails_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "BookDetails" (
    "mediaId" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "estimatedReadTimeMinutes" INTEGER,
    "isbn13" TEXT,

    CONSTRAINT "BookDetails_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "AlbumDetails" (
    "mediaId" INTEGER NOT NULL,
    "totalTracks" INTEGER,
    "durationSeconds" INTEGER,
    "primaryArtistName" TEXT,

    CONSTRAINT "AlbumDetails_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "GameDetails" (
    "mediaId" INTEGER NOT NULL,
    "timeToBeatHours" DECIMAL(5,2),
    "multiplayer" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameDetails_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "UserMediaEntry" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'WISHLIST',
    "ratingValue" INTEGER,
    "reviewText" TEXT,
    "containsSpoilers" BOOLEAN NOT NULL DEFAULT false,
    "startedOn" TIMESTAMP(3),
    "completedOn" TIMESTAMP(3),
    "completionCount" INTEGER NOT NULL DEFAULT 0,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMediaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMediaLogEvent" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER,
    "mediaId" INTEGER,
    "userId" TEXT,
    "eventType" "LogEventType" NOT NULL,
    "bodyText" TEXT,
    "ratingValue" INTEGER,
    "progressValue" TEXT,
    "progressUnit" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMediaLogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileFavorite" (
    "userId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfileFavorite_pkey" PRIMARY KEY ("userId","slotNumber")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" SERIAL NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "actionUserId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaGenre" (
    "mediaId" INTEGER NOT NULL,
    "genreId" INTEGER NOT NULL,

    CONSTRAINT "MediaGenre_pkey" PRIMARY KEY ("mediaId","genreId")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaCredit" (
    "id" SERIAL NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "creditRole" TEXT NOT NULL,
    "characterName" TEXT,
    "billingOrder" INTEGER,

    CONSTRAINT "MediaCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaExternalRef" (
    "id" SERIAL NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaExternalRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "BlobAsset_pathname_key" ON "BlobAsset"("pathname");

-- CreateIndex
CREATE INDEX "MediaItem_type_idx" ON "MediaItem"("type");

-- CreateIndex
CREATE INDEX "MediaItem_title_idx" ON "MediaItem"("title");

-- CreateIndex
CREATE INDEX "MediaItem_releaseDate_idx" ON "MediaItem"("releaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookDetails_isbn13_key" ON "BookDetails"("isbn13");

-- CreateIndex
CREATE INDEX "UserMediaEntry_userId_lastActivityAt_idx" ON "UserMediaEntry"("userId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "UserMediaEntry_mediaId_idx" ON "UserMediaEntry"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMediaEntry_userId_mediaId_key" ON "UserMediaEntry"("userId", "mediaId");

-- CreateIndex
CREATE INDEX "UserMediaLogEvent_entryId_idx" ON "UserMediaLogEvent"("entryId");

-- CreateIndex
CREATE INDEX "UserMediaLogEvent_mediaId_idx" ON "UserMediaLogEvent"("mediaId");

-- CreateIndex
CREATE INDEX "UserMediaLogEvent_userId_idx" ON "UserMediaLogEvent"("userId");

-- CreateIndex
CREATE INDEX "UserMediaLogEvent_createdAt_idx" ON "UserMediaLogEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileFavorite_userId_mediaId_key" ON "UserProfileFavorite"("userId", "mediaId");

-- CreateIndex
CREATE INDEX "Friendship_userAId_idx" ON "Friendship"("userAId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx" ON "Friendship"("userBId");

-- CreateIndex
CREATE INDEX "Friendship_actionUserId_idx" ON "Friendship"("actionUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE INDEX "MediaCredit_mediaId_idx" ON "MediaCredit"("mediaId");

-- CreateIndex
CREATE INDEX "MediaCredit_personId_idx" ON "MediaCredit"("personId");

-- CreateIndex
CREATE INDEX "MediaExternalRef_mediaId_idx" ON "MediaExternalRef"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaExternalRef_provider_externalId_key" ON "MediaExternalRef"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_avatarBlobId_fkey" FOREIGN KEY ("avatarBlobId") REFERENCES "BlobAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_bannerBlobId_fkey" FOREIGN KEY ("bannerBlobId") REFERENCES "BlobAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlobAsset" ADD CONSTRAINT "BlobAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieDetails" ADD CONSTRAINT "MovieDetails_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowDetails" ADD CONSTRAINT "ShowDetails_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookDetails" ADD CONSTRAINT "BookDetails_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumDetails" ADD CONSTRAINT "AlbumDetails_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameDetails" ADD CONSTRAINT "GameDetails_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMediaEntry" ADD CONSTRAINT "UserMediaEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMediaEntry" ADD CONSTRAINT "UserMediaEntry_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMediaLogEvent" ADD CONSTRAINT "UserMediaLogEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "UserMediaEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMediaLogEvent" ADD CONSTRAINT "UserMediaLogEvent_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileFavorite" ADD CONSTRAINT "UserProfileFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileFavorite" ADD CONSTRAINT "UserProfileFavorite_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_actionUserId_fkey" FOREIGN KEY ("actionUserId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaGenre" ADD CONSTRAINT "MediaGenre_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaGenre" ADD CONSTRAINT "MediaGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCredit" ADD CONSTRAINT "MediaCredit_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCredit" ADD CONSTRAINT "MediaCredit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaExternalRef" ADD CONSTRAINT "MediaExternalRef_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
