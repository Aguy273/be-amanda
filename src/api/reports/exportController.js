const prisma = require("../../database/db")
const { uploadMultipleFiles } = require("../../utils/googleDriveUpload")
const path = require("path") // Import path module to use path.basename

/**
 * Export Controller
 * Handles exporting reports with Google Drive integration
 */

module.exports = {
  /**
   * Export reports with images uploaded to Google Drive
   * This endpoint processes all report images and uploads them to Google Drive,
   * then returns the report data with Google Drive links
   */
  exportReportsWithDrive: async (req, res) => {
    try {
      const { status, search, userId, dateFrom, dateTo } = req.query

      const whereClause = {
        deletedAt: null,
      }

      // Filter by status if provided
      if (status && status !== "all") {
        whereClause.status = status
      }

      // Filter by userId if provided
      if (userId) {
        whereClause.userId = userId
      }

      // Search in title and description if search query provided
      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      // Date range filter
      if (dateFrom || dateTo) {
        whereClause.createdAt = {}
        if (dateFrom) {
          whereClause.createdAt.gte = new Date(dateFrom)
        }
        if (dateTo) {
          const endDate = new Date(dateTo)
          endDate.setHours(23, 59, 59, 999)
          whereClause.createdAt.lte = endDate
        }
      }

      // Fetch all reports matching criteria
      const reports = await prisma.report.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          responses: {
            where: { deletedAt: null },
            include: {
              admin: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      // Collect all image paths from reports
      const allImagePaths = []
      const imageToReportMap = new Map()

      reports.forEach((report) => {
        if (report.images && report.images.length > 0) {
          report.images.forEach((imagePath) => {
            allImagePaths.push(imagePath)
            imageToReportMap.set(imagePath, report.id)
          })
        }
      })

      // Upload all images to Google Drive
      let uploadedImages = []
      if (allImagePaths.length > 0) {
        console.log(`Uploading ${allImagePaths.length} images to Google Drive...`)
        uploadedImages = await uploadMultipleFiles(allImagePaths, "Helpdesk Report Images")
        console.log(
          `Upload complete. ${uploadedImages.filter((img) => img.driveLink).length} images uploaded successfully.`,
        )
      }

      // Create a map of original path to drive link
      const imageLinksMap = new Map()
      uploadedImages.forEach((img) => {
        imageLinksMap.set(img.originalPath, {
          driveLink: img.driveLink,
          directLink: img.directLink,
          fileName: img.fileName,
        })
      })

      // Enhance reports with Google Drive links
      const reportsWithDriveLinks = reports.map((report) => {
        const imageLinks = []

        if (report.images && report.images.length > 0) {
          report.images.forEach((imagePath) => {
            const linkData = imageLinksMap.get(imagePath)
            imageLinks.push({
              originalPath: imagePath,
              fileName: linkData?.fileName || path.basename(imagePath),
              driveLink: linkData?.driveLink || "Upload failed",
              directLink: linkData?.directLink || null,
            })
          })
        }

        return {
          ...report,
          imageLinks: imageLinks,
        }
      })

      return res.json({
        success: true,
        message: "Reports exported successfully with Google Drive links",
        data: reportsWithDriveLinks,
        stats: {
          totalReports: reports.length,
          totalImages: allImagePaths.length,
          imagesUploaded: uploadedImages.filter((img) => img.driveLink).length,
          imagesFailed: uploadedImages.filter((img) => !img.driveLink).length,
        },
      })
    } catch (error) {
      console.error("Error exporting reports with Drive:", error)
      return res.status(500).json({
        success: false,
        message: "Failed to export reports",
        error: error.message,
      })
    }
  },

  /**
   * Get export status
   * Returns information about Google Drive integration status
   */
  getExportStatus: async (req, res) => {
    try {
      const driveEnabled = !!(process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY)

      return res.json({
        success: true,
        data: {
          googleDriveEnabled: driveEnabled,
          message: driveEnabled ? "Google Drive integration is active" : "Google Drive integration is not configured",
        },
      })
    } catch (error) {
      console.error("Error checking export status:", error)
      return res.status(500).json({
        success: false,
        message: "Failed to check export status",
      })
    }
  },
}
