const { google } = require("googleapis")
const fs = require("fs")
const path = require("path")
const stream = require("stream")

/**
 * Google Drive Upload Utility
 * Handles uploading files to Google Drive and generating shareable links
 */

// Initialize Google Drive API
const initializeDrive = () => {
  try {
    if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN && process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        'http://localhost:4500/oauth/callback'
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      });

      return google.drive({ version: "v3", auth: oauth2Client });
    }
    else if (process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      return google.drive({ version: "v3", auth });
    } else {
      console.warn("Google Drive credentials not found. Upload to Drive will be skipped.");
      return null;
    }
  } catch (error) {
    console.error("Error initializing Google Drive:", error);
    return null;
  }
}

/**
 * Create a folder in Google Drive
 * @param {string} folderName - Name of the folder to create
 * @param {string} parentFolderId - Optional parent folder ID
 * @returns {Promise<string>} - Folder ID
 */
const createFolder = async (folderName, parentFolderId = null) => {
  const drive = initializeDrive()
  if (!drive) return null

  try {
    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId]
    }

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: "id",
      supportsAllDrives: true,
    })

    return folder.data.id
  } catch (error) {
    console.error("Error creating folder:", error)
    return null
  }
}

/**
 * Upload a file to Google Drive
 * @param {string} filePath - Local file path
 * @param {string} fileName - Name for the file in Drive
 * @param {string} folderId - Optional folder ID to upload to
 * @returns {Promise<Object>} - Object with fileId and webViewLink
 */
const uploadFile = async (filePath, fileName, folderId = null) => {
  const drive = initializeDrive()
  if (!drive) return null

  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath.replace(/^\//, ""));

    if (!fs.existsSync(fullPath)) {
      console.error("File not found:", fullPath)
      return null
    }

    const fileMetadata = {
      name: fileName,
    }

    if (folderId) {
      fileMetadata.parents = [folderId]
    }

    const media = {
      mimeType: getMimeType(fileName),
      body: fs.createReadStream(fullPath),
    }

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
      supportsAllDrives: true,
    })

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    })

    // Get the shareable link
    const fileData = await drive.files.get({
      fileId: file.data.id,
      fields: "webViewLink, webContentLink",
      supportsAllDrives: true,
    })

    return {
      fileId: file.data.id,
      webViewLink: fileData.data.webViewLink,
      webContentLink: fileData.data.webContentLink,
    }
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error)
    return null
  }
}

/**
 * Upload multiple files to Google Drive
 * @param {Array<string>} filePaths - Array of local file paths
 * @param {string} folderName - Name of folder to create for these files
 * @returns {Promise<Array<Object>>} - Array of objects with filePath and driveLink
 */
const uploadMultipleFiles = async (filePaths, folderName = "Report Images") => {
  const drive = initializeDrive()
  if (!drive) {
    console.warn("Google Drive not initialized. Returning original file paths.")
    return filePaths.map((filePath) => ({
      originalPath: filePath,
      driveLink: null,
      fileName: path.basename(filePath),
    }))
  }

  try {
    // Create a folder for this export
    const timestamp = new Date().toISOString().split("T")[0]
    const fullFolderName = `${folderName} - ${timestamp}`
    const folderId = await createFolder(fullFolderName)

    if (!folderId) {
      console.error("Failed to create folder in Google Drive")
      return filePaths.map((filePath) => ({
        originalPath: filePath,
        driveLink: null,
        fileName: path.basename(filePath),
      }))
    }

    // Upload all files
    const uploadPromises = filePaths.map(async (filePath) => {
      const fileName = path.basename(filePath)
      const result = await uploadFile(filePath, fileName, folderId)

      return {
        originalPath: filePath,
        driveLink: result ? result.webViewLink : null,
        directLink: result ? result.webContentLink : null,
        fileName: fileName,
        fileId: result ? result.fileId : null,
      }
    })

    const results = await Promise.all(uploadPromises)
    return results
  } catch (error) {
    console.error("Error uploading multiple files:", error)
    return filePaths.map((filePath) => ({
      originalPath: filePath,
      driveLink: null,
      fileName: path.basename(filePath),
    }))
  }
}

/**
 * Get MIME type from file extension
 * @param {string} fileName - File name with extension
 * @returns {string} - MIME type
 */
const getMimeType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase()
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
  }

  return mimeTypes[ext] || "application/octet-stream"
}

/**
 * Delete a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<boolean>} - Success status
 */
const deleteFile = async (fileId) => {
  const drive = initializeDrive()
  if (!drive) return false

  try {
    await drive.files.delete({
      fileId: fileId,
      supportsAllDrives: true,
    })
    return true
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error)
    return false
  }
}

module.exports = {
  initializeDrive,
  createFolder,
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getMimeType,
}
