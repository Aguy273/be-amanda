const prisma = require("../../database/db");
const { getFileUrls, deleteFiles } = require("../../utils/fileUpload");

module.exports = {
  // Get all reports
  getAll: async (req, res) => {
    try {
      const {
        status,
        search,
        userId,
        priority,
        issueTypeId,
        assignedToId,
        page = 1,
        limit = 10,
      } = req.query;

      // Convert to integers
      const pageNum = Number.parseInt(page);
      const limitNum = Number.parseInt(limit);

      const whereClause = {
        deletedAt: null,
      };

      // Filter by status if provided
      if (status) {
        whereClause.status = status;
      }

      // Filter by priority if provided
      if (
        priority &&
        ["RENDAH", "SEDANG", "TINGGI"].includes(priority.toUpperCase())
      ) {
        whereClause.priority = priority.toUpperCase();
      }

      // Filter by issue type if provided
      if (issueTypeId) {
        whereClause.issueTypeId = issueTypeId;
      }

      // Filter by assigned user if provided
      if (assignedToId) {
        whereClause.assignedToId = assignedToId;
      }

      // Filter by userId if provided (for staff to see their own reports)
      if (userId) {
        whereClause.userId = userId;
      }

      // Search in title and description if search query provided
      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Get total count for pagination metadata
      const totalCount = await prisma.report.count({
        where: whereClause,
      });

      // Calculate pagination values
      const totalPages = Math.ceil(totalCount / limitNum);
      const skip = (pageNum - 1) * limitNum;

      // Fetch paginated data
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
          issueType: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
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
        take: limitNum,
        skip: skip,
        orderBy: { createdAt: "desc" },
      });

      // console.log("fetch reports:", reports)

      return res.json({
        success: true,
        message: "Reports retrieved successfully",
        data: reports,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: limitNum,
        },
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // Get report by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role?.name;

      const report = await prisma.report.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          issueType: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
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
          assignmentLogs: {
             include: {
                previousAssignee: { select: { name: true } },
                newAssignee: { select: { name: true } },
                changedBy: { select: { name: true, role: { select: { name: true } } } }
             },
             orderBy: { createdAt: 'desc' }
          },
        },
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Admin dan Master bisa akses semua laporan
      if (currentUserRole === "STAFF" && report.userId !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: "You can only access your own reports",
        });
      }

      return res.json({
        success: true,
        message: "Report retrieved successfully",
        data: report,
      });
    } catch (error) {
      console.error("Error fetching report:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // Create new report
  create: async (req, res) => {
    try {
      const {
        title,
        description,
        userId,
        images,
        priority,
        issueTypeId,
        assignedToId,
      } = req.body;

      // Validate required fields
      if (!title || !description || !userId) {
        return res.status(400).json({
          success: false,
          message: "Title, description, and userId are required",
        });
      }

      // Validate priority if provided
      if (
        priority &&
        !["RENDAH", "SEDANG", "TINGGI"].includes(priority.toUpperCase())
      ) {
        return res.status(400).json({
          success: false,
          message: "Priority must be RENDAH, SEDANG, or TINGGI",
        });
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if issue type exists (if provided)
      if (issueTypeId) {
        const issueType = await prisma.issueType.findFirst({
          where: {
            id: issueTypeId,
            deletedAt: null,
          },
        });

        if (!issueType) {
          return res.status(404).json({
            success: false,
            message: "Issue type not found",
          });
        }
      }

      // Check if assigned user exists (if provided)
      if (assignedToId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: assignedToId },
        });

        if (!assignedUser) {
          return res.status(404).json({
            success: false,
            message: "Assigned user not found",
          });
        }
      }

      // Handle file uploads
      let fileUrls = [];
      let driveFileIds = [];
      let driveLinks = [];

      if (req.files && req.files.length > 0) {
        fileUrls = getFileUrls(
          req.files,
          `${req.protocol}://${req.get("host")}`
        );

        const {
          uploadMultipleFiles,
        } = require("../../utils/googleDriveUpload");
        const filePaths = req.files.map((file) => file.path);
        const uploadResults = await uploadMultipleFiles(
          filePaths,
          "E-Helpdesk Reports"
        );

        const failedUploads = uploadResults.filter(
          (result) => !result.driveLink
        );

        if (failedUploads.length > 0 && process.env.GOOGLE_DRIVE_CLIENT_EMAIL) {
          console.error(
            "Google Drive upload failed for some files:",
            failedUploads
          );

          deleteFiles(fileUrls);

          return res.status(500).json({
            success: false,
            message:
              "Failed to upload files to Google Drive. Please try again.",
            error: "Google Drive upload failed",
          });
        }

        driveFileIds = uploadResults
          .filter((result) => result.fileId)
          .map((result) => result.fileId);

        driveLinks = uploadResults
          .filter((result) => result.driveLink)
          .map((result) => result.driveLink);

        console.log("Files uploaded to Google Drive:", {
          total: uploadResults.length,
          successful: driveLinks.length,
          failed: failedUploads.length,
        });
      }

      // Use uploaded files or existing images from body
      const finalImages = fileUrls.length > 0 ? fileUrls : images || [];

      const newReport = await prisma.report.create({
        data: {
          title,
          description,
          status: "PENDING",
          priority: priority ? priority.toUpperCase() : "SEDANG",
          userId,
          issueTypeId: issueTypeId || null,
          assignedToId: assignedToId || null,
          images: finalImages,
          driveFileIds: driveFileIds,
          driveLinks: driveLinks,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          issueType: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      try {
        const {
          sendReportNotification,
        } = require("../../utils/notificationHelper");
        await sendReportNotification(
          newReport,
          "CREATED",
          newReport.user.role.name,
          newReport.user.name
        );
      } catch (notifError) {
        console.error("Error sending notification:", notifError);
      }

      return res.status(201).json({
        success: true,
        message: "Report created successfully",
        data: newReport,
      });
    } catch (error) {
      console.error("Error creating report:", error);

      // Delete uploaded files if report creation fails
      if (req.files && req.files.length > 0) {
        const fileUrls = getFileUrls(req.files);
        deleteFiles(fileUrls);
      }

      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // Update report (status, etc.)
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, status, images, keepExistingFiles } =
        req.body;

      console.log("Update report data:", req.body);
      console.log("Update report files:", req.files?.length || 0);

      // Check if report exists
      const existingReport = await prisma.report.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingReport) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Validate status if provided
      const validStatuses = [
        "PENDING",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
        "ON_HOLD",
      ];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Valid statuses: PENDING, IN_PROGRESS, RESOLVED, CLOSED, ON_HOLD",
        });
      }

      const updateData = {};
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (status) updateData.status = status;

      let newAssigneeId = undefined;
      let isAssignmentChanging = false;

      if (req.body.assignedToId !== undefined) {
        // If "null" string or empty string, set to null, otherwise use the value
        if (req.body.assignedToId === "null" || req.body.assignedToId === "") {
          newAssigneeId = null;
        } else {
          newAssigneeId = req.body.assignedToId;
        }

        if (newAssigneeId !== existingReport.assignedToId) {
          isAssignmentChanging = true;
          updateData.assignedToId = newAssigneeId;
        }
      }

      // Validate Reason for Assignment Change
      // Only require reason if RE-ASSIGNING (changing from one person to another)
      if (isAssignmentChanging && existingReport.assignedToId) {
        if (
          !req.body.assignmentReason ||
          req.body.assignmentReason.trim() === ""
        ) {
          return res.status(400).json({
            success: false,
            message: "Alasan pengalihan tugas wajib diisi!", // "Reason is required"
          });
        }
      }

      // Handle file uploads
      let newFileUrls = [];
      if (req.files && req.files.length > 0) {
        newFileUrls = getFileUrls(
          req.files,
          `${req.protocol}://${req.get("host")}`
        );
      }

      // Determine final images array
      let finalImages = [];
      if (keepExistingFiles === "true" && existingReport.images) {
        // Keep existing images and add new ones
        finalImages = [...existingReport.images, ...newFileUrls];
      } else if (newFileUrls.length > 0) {
        // Replace all images with new ones
        if (existingReport.images && existingReport.images.length > 0) {
          deleteFiles(existingReport.images);
        }
        finalImages = newFileUrls;
      } else if (images && Array.isArray(images)) {
        // Use images from body (for direct URL updates)
        finalImages = images;
      } else if (keepExistingFiles !== "true") {
        // Remove all images if keepExistingFiles is not true and no new files
        if (existingReport.images && existingReport.images.length > 0) {
          deleteFiles(existingReport.images);
        }
        finalImages = [];
      } else {
        // Keep existing images only
        finalImages = existingReport.images || [];
      }

      updateData.images = finalImages;

      const updatedReport = await prisma.report.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
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
      });

      // Send notifications when report is updated (especially status changes)
      if (status && req.user) {
        try {
          const {
            sendNotificationToRoles,
            sendNotificationToUsers,
          } = require("../../utils/notificationHelper");
          const updaterRole = req.user.role?.name;
          const updaterName = req.user.name;

          const statusText =
            {
              PENDING: "Menunggu",
              IN_PROGRESS: "Dikerjakan",
              RESOLVED: "Selesai",
              CLOSED: "Ditutup",
              ON_HOLD: "Ditahan",
            }[status] || status;

          const title = "Update Laporan";
          const message = `${updaterName} mengubah status laporan "${updatedReport.title}" menjadi ${statusText}`;
          const type = "REPORT_UPDATE";

          if (updaterRole === "MASTER") {
            // MASTER updated - notify ADMIN and STAFF (report creator)
            const adminNotifications = await sendNotificationToRoles(
              title,
              message,
              type,
              ["ADMIN"]
            );

            const staffNotifications = await sendNotificationToUsers(
              title,
              message,
              type,
              [updatedReport.userId]
            );

            console.log(
              `Sent ${
                adminNotifications.length + staffNotifications.length
              } update notifications`
            );
          } else if (updaterRole === "ADMIN") {
            // ADMIN updated - notify MASTER and STAFF (report creator)
            const masterNotifications = await sendNotificationToRoles(
              title,
              message,
              type,
              ["MASTER"]
            );

            const staffNotifications = await sendNotificationToUsers(
              title,
              message,
              type,
              [updatedReport.userId]
            );

            console.log(
              `Sent ${
                masterNotifications.length + staffNotifications.length
              } update notifications`
            );
          }
        } catch (notifError) {
          console.error("Error sending update notification:", notifError);
        }
      }

      if (updateData.assignedToId && updatedReport.assignedTo) {
        try {
          const {
            sendNotificationToUsers,
            sendNotificationToRoles,
          } = require("../../utils/notificationHelper");
          const picName = updatedReport.assignedTo.name;

          await sendNotificationToUsers(
            "Tugas Baru",
            `Anda telah ditugaskan sebagai PIC untuk laporan: "${updatedReport.title}"`,
            "ASSIGNMENT",
            [updateData.assignedToId]
          );

          if (updatedReport.userId !== updateData.assignedToId) {
            await sendNotificationToUsers(
              "Laporan Ditangani",
              `Laporan Anda "${updatedReport.title}" kini ditangani oleh ${picName}`,
              "ASSIGNMENT",
              [updatedReport.userId]
            );
          }

          await sendNotificationToRoles(
            "Info Penugasan",
            `Laporan "${updatedReport.title}" telah ditugaskan kepada ${picName}`,
            "ASSIGNMENT",
            ["ADMIN", "MASTER"]
          );

          console.log(
            "Sent assignment notifications to Assigned, Reporter, and Roles"
          );
        } catch (assignError) {
          console.error("Error sending assignment notification:", assignError);
        }
      }

      // Create Audit Log for Assignment Change
      // Log for BOTH Initial Assignment and Re-assignment
      if (isAssignmentChanging) {
        try {
          // If reason is not provided (e.g. initial assignment), use default
          const logReason = req.body.assignmentReason || "Penugasan Awal";
          
          await prisma.reportAssignmentLog.create({
            data: {
              reportId: updatedReport.id,
              previousAssigneeId: existingReport.assignedToId,
              newAssigneeId: updateData.assignedToId, 
              changedById: req.user.id,
              reason: logReason, 
            },
          });
          console.log("Created Assignment Log");
        } catch (logError) {
          console.error("Error creating assignment log:", logError);
          // Note: We don't revert the update here, but we log the error.
          // Ideally this should be in a transaction with the update.
        }
      }

      return res.json({
        success: true,
        message: "Report updated successfully",
        data: updatedReport,
      });
    } catch (error) {
      console.error("Error updating report:", error);

      // Delete uploaded files if update fails
      if (req.files && req.files.length > 0) {
        const fileUrls = getFileUrls(req.files);
        deleteFiles(fileUrls);
      }

      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // Add response to report
  addResponse: async (req, res) => {
    try {
      const { id } = req.params;
      const { message, adminId, images } = req.body;

      if (!message || !adminId) {
        return res.status(400).json({
          success: false,
          message: "Message and adminId are required",
        });
      }

      // Check if report exists
      const existingReport = await prisma.report.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingReport) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Check if admin exists and get role info
      const admin = await prisma.user.findFirst({
        where: {
          id: adminId,
          role: {
            name: { in: ["ADMIN", "MASTER"] },
          },
        },
        include: {
          role: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found or insufficient permissions",
        });
      }

      // Handle file uploads
      let fileUrls = [];
      let driveFileIds = [];
      let driveLinks = [];

      if (req.files && req.files.length > 0) {
        fileUrls = getFileUrls(
          req.files,
          `${req.protocol}://${req.get("host")}`
        );

        const {
          uploadMultipleFiles,
        } = require("../../utils/googleDriveUpload");
        const filePaths = req.files.map((file) => file.path);
        const uploadResults = await uploadMultipleFiles(
          filePaths,
          "E-Helpdesk Responses"
        );

        const failedUploads = uploadResults.filter(
          (result) => !result.driveLink
        );

        if (failedUploads.length > 0 && process.env.GOOGLE_DRIVE_CLIENT_EMAIL) {
          console.error(
            "Google Drive upload failed for response files:",
            failedUploads
          );
          deleteFiles(fileUrls);

          return res.status(500).json({
            success: false,
            message:
              "Failed to upload files to Google Drive. Please try again.",
            error: "Google Drive upload failed",
          });
        }

        driveFileIds = uploadResults
          .filter((result) => result.fileId)
          .map((result) => result.fileId);

        driveLinks = uploadResults
          .filter((result) => result.driveLink)
          .map((result) => result.driveLink);

        console.log("Response files uploaded to Google Drive:", {
          total: uploadResults.length,
          successful: driveLinks.length,
        });
      }

      // Use uploaded files or existing images from body
      const finalImages = fileUrls.length > 0 ? fileUrls : images || [];

      const response = await prisma.reportResponse.create({
        data: {
          message,
          reportId: id,
          adminId,
          images: finalImages,
          driveFileIds: driveFileIds,
          driveLinks: driveLinks,
        },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Update report status to IN_PROGRESS if it's still PENDING
      if (existingReport.status === "PENDING") {
        await prisma.report.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });
      }

      // Send notifications based on responder role
      try {
        const {
          sendReportNotification,
        } = require("../../utils/notificationHelper");
        const reportWithUser = {
          ...existingReport,
          title: existingReport.title,
        };
        await sendReportNotification(
          reportWithUser,
          "RESPONSE",
          admin.role.name,
          admin.name
        );
      } catch (notifError) {
        console.error("Error sending notification:", notifError);
        // Don't fail the request if notification fails
      }

      return res.status(201).json({
        success: true,
        message: "Response added successfully",
        data: response,
      });
    } catch (error) {
      console.error("Error adding response:", error);

      // Delete uploaded files if response creation fails
      if (req.files && req.files.length > 0) {
        const fileUrls = getFileUrls(req.files);
        deleteFiles(fileUrls);
      }

      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // Soft delete report
  destroy: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if report exists and get all related responses
      const existingReport = await prisma.report.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          responses: {
            where: { deletedAt: null },
          },
        },
      });

      if (!existingReport) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Delete associated files from report
      if (existingReport.images && existingReport.images.length > 0) {
        deleteFiles(existingReport.images);
      }

      if (
        existingReport.driveFileIds &&
        existingReport.driveFileIds.length > 0
      ) {
        const { deleteFile } = require("../../utils/googleDriveUpload");
        for (const fileId of existingReport.driveFileIds) {
          await deleteFile(fileId);
        }
        console.log(
          `Deleted ${existingReport.driveFileIds.length} files from Google Drive (report)`
        );
      }

      // Delete associated files from responses
      if (existingReport.responses && existingReport.responses.length > 0) {
        existingReport.responses.forEach((response) => {
          if (response.images && response.images.length > 0) {
            deleteFiles(response.images);
          }
        });

        for (const response of existingReport.responses) {
          if (response.driveFileIds && response.driveFileIds.length > 0) {
            const { deleteFile } = require("../../utils/googleDriveUpload");
            for (const fileId of response.driveFileIds) {
              await deleteFile(fileId);
            }
          }
        }

        // Soft delete all responses
        await prisma.reportResponse.updateMany({
          where: {
            reportId: id,
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }

      // Soft delete the report
      await prisma.report.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return res.json({
        success: true,
        message: "Report and associated files deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting report:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
};
