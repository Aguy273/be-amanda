-- AlterTable
ALTER TABLE "report_responses" ADD COLUMN     "drive_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "drive_links" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "drive_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "drive_links" TEXT[] DEFAULT ARRAY[]::TEXT[];
