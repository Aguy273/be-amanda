const router = require("express").Router()
const { authenticateToken, requireAdmin } = require("../../utils/authMiddleware")
const { exportReportsWithDrive, getExportStatus } = require("./exportController")

// Export routes - admin/master only
router.get("/reports/export/drive", authenticateToken, requireAdmin, exportReportsWithDrive)

router.get("/reports/export/status", authenticateToken, requireAdmin, getExportStatus)

module.exports = router
