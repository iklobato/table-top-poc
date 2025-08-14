-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "public"."QuestionSource" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "public"."QuestionStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "public"."RoundStatus" AS ENUM ('PENDING', 'LIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."Choice" AS ENUM ('A', 'B', 'C', 'D');

-- CreateTable
CREATE TABLE "public"."Table" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "total_rounds" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionTable" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Player" (
    "id" TEXT NOT NULL,
    "display_name" TEXT,
    "table_id" TEXT,
    "session_id" TEXT,
    "role_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Question" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "topic" TEXT NOT NULL,
    "source" "public"."QuestionSource" NOT NULL DEFAULT 'MANUAL',
    "status" "public"."QuestionStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionVariant" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "role_id" TEXT,
    "prompt" TEXT NOT NULL,
    "choice_a" TEXT NOT NULL,
    "choice_b" TEXT NOT NULL,
    "choice_c" TEXT NOT NULL,
    "choice_d" TEXT NOT NULL,
    "points_a" INTEGER NOT NULL,
    "points_b" INTEGER NOT NULL,
    "points_c" INTEGER NOT NULL,
    "points_d" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "QuestionVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Round" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "status" "public"."RoundStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "variant_set_id" TEXT,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Answer" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "role_id" TEXT,
    "table_id" TEXT,
    "choice" "public"."Choice" NOT NULL,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "response_ms" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeaderboardCache" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "round_id" TEXT,
    "table_id" TEXT NOT NULL,
    "raw_points" INTEGER NOT NULL DEFAULT 0,
    "normalized_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_response_ms" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeaderboardCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardCache_session_id_round_id_table_id_key" ON "public"."LeaderboardCache"("session_id", "round_id", "table_id");

-- AddForeignKey
ALTER TABLE "public"."SessionTable" ADD CONSTRAINT "SessionTable_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionTable" ADD CONSTRAINT "SessionTable_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Question" ADD CONSTRAINT "Question_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionVariant" ADD CONSTRAINT "QuestionVariant_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionVariant" ADD CONSTRAINT "QuestionVariant_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Round" ADD CONSTRAINT "Round_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardCache" ADD CONSTRAINT "LeaderboardCache_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardCache" ADD CONSTRAINT "LeaderboardCache_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardCache" ADD CONSTRAINT "LeaderboardCache_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
