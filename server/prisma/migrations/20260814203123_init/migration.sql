-- CreateEnum
CREATE TYPE "InvestorType" AS ENUM ('HODLER', 'DAY_TRADER', 'NFT_COLLECTOR');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('MARKET_NEWS', 'CHARTS', 'SOCIAL', 'FUN');

-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('NEWS', 'PRICES', 'INSIGHT', 'MEME');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "onboarding_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assets" TEXT[],
    "investor_type" "InvestorType" NOT NULL,
    "content_types" "ContentType"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "section_type" "SectionType" NOT NULL,
    "item_ref" TEXT NOT NULL,
    "vote" "VoteType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "for_date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "preferences_user_id_key" ON "preferences"("user_id");

-- CreateIndex
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_section_type_vote_idx" ON "feedback"("section_type", "vote");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_user_id_section_type_item_ref_key" ON "feedback"("user_id", "section_type", "item_ref");

-- CreateIndex
CREATE UNIQUE INDEX "daily_insights_user_id_for_date_key" ON "daily_insights"("user_id", "for_date");

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_insights" ADD CONSTRAINT "daily_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
