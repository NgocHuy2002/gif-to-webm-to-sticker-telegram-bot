const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

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

// Read all files in the folder
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
        "-c:v libvpx-vp9", // Use VP9 codec for better compatibility
        "-crf 35", // Constant quality mode (lower values yield higher quality)
        "-b:v 0", // No bitrate limit
        "-c:a libopus", // Use Opus audio codec
        "-vf scale=512:512:force_original_aspect_ratio=decrease" // Scale to fit within 512x512
      ])
      .on("start", (commandLine) => {
        console.log(`Spawned ffmpeg with command: ${commandLine}`);
      })
      .on("progress", (progress) => {
        // console.log(progress);
        // const percent = Math.round((progress.frames / progress.totalFrames) * 100);
        // console.log(`Processing: ${percent}% done`);
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
