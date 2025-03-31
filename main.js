const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

// Replace these with your details:
const BOT_TOKEN = process.env.BOT_TOKEN;
const USER_ID = parseInt(process.env.USER_ID); // your Telegram user ID
const stickerSetName = process.env.STICKER_SET_NAME; // sticker set name must end with '_by_<botusername>'
const stickerSetTitle = process.env.STICKER_SET_TITLE; // title of your sticker set
const emojiForSticker = process.env.EMOJI_FOR_STICKER; // default emoji to associate with each sticker

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Automatically set the ffmpeg binary path if available
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// Folder where your GIF files are stored
const folderPath = path.join(__dirname, "gifs");
const outputFolderPath = path.join(__dirname, "webm");

// Create folders if they don't exist
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath);
  console.log("Created gifs folder");
}

if (!fs.existsSync(outputFolderPath)) {
  fs.mkdirSync(outputFolderPath);
  console.log("Created webm folder");
}

// #region Read all files in the folder
fs.readdir(folderPath, (err, files) => {
  if (err) {
    return console.error("Error reading directory:", err);
  }

  // Filter to get only .gif files
  const gifFiles = files.filter((file) => path.extname(file).toLowerCase() === ".gif");

  if (gifFiles.length === 0) {
    console.log("No GIF files found in the folder.");
    return;
  }

  // Process each GIF file
  gifFiles.forEach((file) => {
    const inputPath = path.join(folderPath, file);
    const outputFileName = path.basename(file, path.extname(file)) + ".webm";
    const outputPath = path.join(outputFolderPath, outputFileName);

    console.log(`Converting ${file} to ${outputFileName}...`);

    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libvpx-vp9", // Use VP9 codec
        "-crf 41", // Increased CRF for smaller file size (30-50, higher = smaller file)
        "-b:v 150k", // Set maximum bitrate
        "-maxrate 150k", // Maximum bitrate constraint
        "-bufsize 150k", // Buffering constraint
        "-vf scale=512:512:force_original_aspect_ratio=decrease,fps=30", // Scale and limit framerate
        "-an", // Remove audio
        "-t 3" // Limit duration to 3 seconds
      ])
      .on("start", (commandLine) => {
        console.log(`Spawned ffmpeg with command: ${commandLine}`);
      })
      .on("progress", (progress) => {
        // console.log(progress);
      })
      .on("end", () => {
        console.log(`Successfully converted ${file} to ${outputFileName}`);
      })
      .on("error", (err, stdout, stderr) => {
        console.error(`Error converting ${file}:`, err.message);
        console.error(`ffmpeg stdout: ${stdout}`);
        console.error(`ffmpeg stderr: ${stderr}`);
      })
      .save(outputPath);
  });
});
// #endregion

// #region Function to upload a WebM file and add it as a sticker to your sticker set
async function addSticker(filePath) {
  try {
    // Upload the sticker file to Telegram
    const uploadResponse = await bot.uploadStickerFile(USER_ID, fs.createReadStream(filePath));
    const fileId = uploadResponse.file_id;
    console.log(`Uploaded ${path.basename(filePath)} with file_id: ${fileId}`);

    // Add the uploaded file to your sticker set
    await bot.addStickerToSet(USER_ID, stickerSetName, {
      sticker: fileId,
      emoji: emojiForSticker,
    });
    console.log(`Added ${path.basename(filePath)} to sticker set "${stickerSetName}"`);
  } catch (error) {
    console.error(`Error processing ${path.basename(filePath)}:`, error.message);
  }
}
// #endregion

// #region Function to create a new sticker set
async function createStickerSet(firstStickerPath) {
  try {
    // Upload the first sticker file
    const uploadResponse = await bot.uploadStickerFile(USER_ID, fs.createReadStream(firstStickerPath));
    const fileId = uploadResponse.file_id;

    // Create the sticker set with the first sticker
    await bot.createNewStickerSet(USER_ID, stickerSetName, stickerSetTitle, {
      sticker: fileId,
      emoji: emojiForSticker,
    });
    console.log(`Created new sticker set: ${stickerSetName}`);
    return true;
  } catch (error) {
    console.error("Error creating sticker set:", error.message);
    return false;
  }
}
// #endregion

// #region Main function to process all WebM files in the folder
async function processStickers() {
  try {
    const files = fs.readdirSync(outputFolderPath);
    const webmFiles = files.filter((file) => path.extname(file).toLowerCase() === ".webm");

    if (webmFiles.length === 0) {
      console.log("No WebM files found in the folder.");
      return;
    }

    // Check if the sticker set exists
    let stickerSetExists = true;
    try {
      await bot.getStickerSet(stickerSetName);
    } catch (error) {
      stickerSetExists = false;
    }

    // Create the sticker set with the first sticker if it doesn't exist
    if (!stickerSetExists) {
      const firstFilePath = path.join(outputFolderPath, webmFiles[0]);
      const created = await createStickerSet(firstFilePath);
      if (!created) return;
      // Start from the second file
      webmFiles.shift();
    }

    // Process remaining files
    for (const file of webmFiles) {
      const filePath = path.join(outputFolderPath, file);
      await addSticker(filePath);
    }
    console.log("All stickers processed.");
  } catch (err) {
    console.error("Error processing stickers:", err.message);
  }
}
// #endregion
processStickers();
