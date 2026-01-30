-- CreateTable
CREATE TABLE "report_assignment_logs" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "previous_assignee_id" TEXT,
    "new_assignee_id" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_assignment_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "report_assignment_logs" ADD CONSTRAINT "report_assignment_logs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_assignment_logs" ADD CONSTRAINT "report_assignment_logs_previous_assignee_id_fkey" FOREIGN KEY ("previous_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_assignment_logs" ADD CONSTRAINT "report_assignment_logs_new_assignee_id_fkey" FOREIGN KEY ("new_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_assignment_logs" ADD CONSTRAINT "report_assignment_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
