const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4 } = require("uuid");
const {
  normalizePath,
  sanitizeFileName,
  policyComparisonsPath,
} = require(".");

/**
 * Handle File uploads for auto-uploading.
 * Mostly used for internal GUI/API uploads.
 */
const fileUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput =
      process.env.NODE_ENV === "development"
        ? path.resolve(__dirname, `../../../collector/hotdir`)
        : path.resolve(process.env.STORAGE_DIR, `../../collector/hotdir`);
    cb(null, uploadOutput);
  },
  filename: function (_, file, cb) {
    file.originalname = sanitizeFileName(
      normalizePath(Buffer.from(file.originalname, "latin1").toString("utf8"))
    );
    cb(null, file.originalname);
  },
});

/**
 * Handle API file upload as documents - this does not manipulate the filename
 * at all for encoding/charset reasons.
 */
const fileAPIUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput =
      process.env.NODE_ENV === "development"
        ? path.resolve(__dirname, `../../../collector/hotdir`)
        : path.resolve(process.env.STORAGE_DIR, `../../collector/hotdir`);
    cb(null, uploadOutput);
  },
  filename: function (_, file, cb) {
    file.originalname = sanitizeFileName(
      normalizePath(Buffer.from(file.originalname, "latin1").toString("utf8"))
    );
    cb(null, file.originalname);
  },
});

// Asset storage for logos
const assetUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput =
      process.env.NODE_ENV === "development"
        ? path.resolve(__dirname, `../../storage/assets`)
        : path.resolve(process.env.STORAGE_DIR, "assets");
    fs.mkdirSync(uploadOutput, { recursive: true });
    return cb(null, uploadOutput);
  },
  filename: function (_, file, cb) {
    file.originalname = sanitizeFileName(
      normalizePath(Buffer.from(file.originalname, "latin1").toString("utf8"))
    );
    cb(null, file.originalname);
  },
});

/**
 * Handle PFP file upload as logos
 */
const pfpUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput =
      process.env.NODE_ENV === "development"
        ? path.resolve(__dirname, `../../storage/assets/pfp`)
        : path.resolve(process.env.STORAGE_DIR, "assets/pfp");
    fs.mkdirSync(uploadOutput, { recursive: true });
    return cb(null, uploadOutput);
  },
  filename: function (req, file, cb) {
    const randomFileName = `${v4()}${path.extname(
      normalizePath(file.originalname)
    )}`;
    req.randomFileName = randomFileName;
    cb(null, randomFileName);
  },
});

/**
 * Handle Generic file upload as documents from the GUI
 * @param {Request} request
 * @param {Response} response
 * @param {NextFunction} next
 */
function handleFileUpload(request, response, next) {
  const upload = multer({ storage: fileUploadStorage }).single("file");
  upload(request, response, function (err) {
    if (err) {
      response
        .status(500)
        .json({
          success: false,
          error: `Invalid file upload. ${err.message}`,
        })
        .end();
      return;
    }
    next();
  });
}

const policyComparisonUploadStorage = multer.diskStorage({
  destination: function (request, _, cb) {
    const sessionUuid = request.policyComparisonSession?.uuid;
    if (!sessionUuid)
      return cb(new Error("Comparison session was not authorized."));
    const output = path.resolve(
      policyComparisonsPath,
      "uploads",
      sessionUuid
    );
    fs.mkdirSync(output, { recursive: true, mode: 0o700 });
    fs.chmodSync(output, 0o700);
    return cb(null, output);
  },
  filename: function (request, file, cb) {
    file.originalname = sanitizeFileName(
      normalizePath(Buffer.from(file.originalname, "latin1").toString("utf8"))
    );
    const storedName = `${v4()}.pdf`;
    request.policyComparisonStoredName = storedName;
    return cb(null, storedName);
  },
});

/**
 * Persist one comparison PDF after the endpoint has authorized the session.
 * The randomized private file never enters collector/hotdir or the workspace
 * document index.
 */
function handlePolicyComparisonUpload(request, response, next) {
  const upload = multer({
    storage: policyComparisonUploadStorage,
    limits: { fileSize: 512 * 1024 * 1024, files: 1 },
    fileFilter: (_, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const allowedMime = ["application/pdf", "application/octet-stream"].includes(
        file.mimetype
      );
      if (extension !== ".pdf" || !allowedMime)
        return cb(new Error("Only PDF documents are allowed."));
      return cb(null, true);
    },
  }).single("file");
  upload(request, response, function (err) {
    if (err) {
      return response.status(400).json({
        success: false,
        error: `Invalid comparison upload. ${err.message}`,
      });
    }
    next();
  });
}

/**
 * Handle API file upload as documents - this does not manipulate the filename
 * at all for encoding/charset reasons.
 * @param {Request} request
 * @param {Response} response
 * @param {NextFunction} next
 */
function handleAPIFileUpload(request, response, next) {
  const upload = multer({ storage: fileAPIUploadStorage }).single("file");
  upload(request, response, function (err) {
    if (err) {
      response
        .status(500)
        .json({
          success: false,
          error: `Invalid file upload. ${err.message}`,
        })
        .end();
      return;
    }
    next();
  });
}

/**
 * Handle logo asset uploads
 */
function handleAssetUpload(request, response, next) {
  const upload = multer({ storage: assetUploadStorage }).single("logo");
  upload(request, response, function (err) {
    if (err) {
      response
        .status(500)
        .json({
          success: false,
          error: `Invalid file upload. ${err.message}`,
        })
        .end();
      return;
    }
    next();
  });
}

/**
 * Handle PFP file upload as logos
 */
function handlePfpUpload(request, response, next) {
  const upload = multer({ storage: pfpUploadStorage }).single("file");
  upload(request, response, function (err) {
    if (err) {
      response
        .status(500)
        .json({
          success: false,
          error: `Invalid file upload. ${err.message}`,
        })
        .end();
      return;
    }
    next();
  });
}

/**
 * Handle in-memory audio upload for STT transcription. Audio buffers are
 * passed straight to the STT provider so we never persist them to disk.
 */
function handleAudioUpload(request, response, next) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB matches OpenAI Whisper limit
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype?.startsWith("audio/"))
        return cb(new Error("Only audio uploads are allowed."));
      cb(null, true);
    },
  }).single("audio");
  upload(request, response, function (err) {
    if (err) {
      return response.status(500).json({
        success: false,
        error: `Invalid audio upload. ${err.message}`,
      });
    }
    next();
  });
}

/**
 * Handle in-memory image upload for image generation/editing. Buffers are
 * passed directly to the image generation provider, never persisted to disk.
 */
function handleImageGenUpload(request, response, next) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype?.startsWith("image/"))
        return cb(new Error("Only image uploads are allowed."));
      cb(null, true);
    },
  }).array("image_references", 10);
  upload(request, response, function (err) {
    if (err) {
      return response.status(500).json({
        success: false,
        error: `Invalid image upload. ${err.message}`,
      });
    }
    next();
  });
}

module.exports = {
  handleFileUpload,
  handleAPIFileUpload,
  handleAssetUpload,
  handlePfpUpload,
  handleAudioUpload,
  handleImageGenUpload,
  handlePolicyComparisonUpload,
};
