/*
  Warnings:

  - You are about to drop the `chat_responses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."chat_responses" DROP CONSTRAINT "chat_responses_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."chat_responses" DROP CONSTRAINT "chat_responses_chat_id_fkey";

-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipient_id" TEXT;

-- DropTable
DROP TABLE "public"."chat_responses";

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
