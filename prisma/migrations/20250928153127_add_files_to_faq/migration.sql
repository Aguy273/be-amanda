-- AlterTable
ALTER TABLE "public"."faqs" ADD COLUMN     "files" TEXT[] DEFAULT ARRAY[]::TEXT[];
