-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "question_id" TEXT;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
