ALTER TABLE "User" ADD COLUMN "username" TEXT, ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "AuthAttempt" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("key")
);
