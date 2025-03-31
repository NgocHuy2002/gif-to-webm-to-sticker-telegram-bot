const express = require("express");
const expressApp = express();
const axios = require("axios");
const path = require("path");
const port = process.env.PORT || 3000;
expressApp.use(express.static("static"));
expressApp.use(express.json());
require("dotenv").config();

const { Telegraf } = require("telegraf");
const fs = require("fs");
const { InputFile } = require("grammy");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Add webm folder path
const webmFolderPath = path.join(__dirname, "webm");

// Add this map to store user's sticker set names
const userStickerSets = new Map();

expressApp.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

bot.launch();

bot.command("start", (ctx) => {
  console.log(ctx.from);
  bot.telegram.sendMessage(ctx.chat.id, "Hello! I can help create video sticker sets.\n" + "1. First use /setstickername <name> to set your sticker set name\n" + "2. Then use /createstickers to create the sticker set", {});
});

bot.command("ethereum", (ctx) => {
  var rate;
  console.log(ctx.from);
  axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`).then((response) => {
    console.log(response.data);
    rate = response.data.ethereum;
    const message = `Hello, today the ethereum price is ${rate.usd}USD`;
    bot.telegram.sendMessage(ctx.chat.id, message, {});
  });
});

bot.command("send", (ctx) => {
  var rate;
  const files = fs.readdirSync(webmFolderPath);
  const webmFiles = files.filter((file) => path.extname(file).toLowerCase() === ".webm");

  if (webmFiles.length === 0) {
    return ctx.reply("No WebM files found in the folder.");
  }
  const firstFilePath = path.join(webmFolderPath, webmFiles[0]);
  ctx.reply(`Found ${webmFiles.length} WebM files. Starting video sticker set creation...`);
  ctx.reply(`files ${files}`);
  ctx.reply(`File in ${firstFilePath}`);
  ctx.replyWithPhoto(new InputFile(fs.createReadStream(firstFilePath)));
});

// Add new command to set sticker name
bot.command("setstickername", (ctx) => {
  const input = ctx.message.text.split(" ").slice(1).join("_");
  if (!input) {
    return ctx.reply("Please provide a name for your sticker set.\nExample: /setstickername mycoolstickers");
  }

  // Clean the input: only allow letters, numbers, and underscores
  const cleanInput = input.replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/__+/g, '_'); // Remove consecutive underscores

  // Make sure it starts with a letter
  if (!/^[a-zA-Z]/.test(cleanInput)) {
    return ctx.reply("Sticker set name must begin with a letter.");
  }

  // Get bot username and clean it (remove @ if present)
  const botUsername = ctx.botInfo.username.replace('@', '');
  
  // Create the properly formatted sticker set name
  const stickerSetName = `${cleanInput}_by_${botUsername}`;

  // Validate length (1-64 characters)
  if (stickerSetName.length > 64) {
    return ctx.reply("Sticker set name is too long. Please use a shorter name.");
  }

  userStickerSets.set(ctx.from.id, stickerSetName);
  ctx.reply(`Sticker set name set to: ${stickerSetName}`);
});

bot.command("createstickers", async (ctx) => {
  try {
    const stickerSetName = userStickerSets.get(ctx.from.id);
    if (!stickerSetName) {
      return ctx.reply("Please set a sticker set name first using /setstickername <name>");
    }

    const files = fs.readdirSync(webmFolderPath);
    const webmFiles = files.filter(file => path.extname(file).toLowerCase() === '.webm');

    if (webmFiles.length === 0) {
      return ctx.reply('No WebM files found in the folder.');
    }

    ctx.reply(`Found ${webmFiles.length} WebM files. Starting video sticker set creation...`);

    const firstFilePath = path.join(webmFolderPath, webmFiles[0]);

    try {
      // Create new video sticker set with first sticker
      await ctx.telegram.createNewStickerSet(
        ctx.from.id,
        stickerSetName,
        stickerSetName,
        {
          webm_sticker: { source: firstFilePath },
          emoji_list: [':scissors:']
        },
        // 'video'  // Specify sticker type as video
      );

      // Add remaining stickers
      for (let i = 1; i < webmFiles.length; i++) {
        const filePath = path.join(webmFolderPath, webmFiles[i]);
        
        await ctx.telegram.addStickerToSet(
          ctx.from.id,
          stickerSetName,
          {
            webm_sticker: { source: filePath },
            emoji_list: [':scissors:']
          }
        );

        await ctx.reply(`Added video sticker ${i + 1}/${webmFiles.length}`);
      }

      ctx.reply(`Video sticker set created! View it here: https://t.me/addstickers/${stickerSetName}`);
      
      // Clear the stored name after successful creation
      userStickerSets.delete(ctx.from.id);
    } catch (error) {
      if (error.message.includes("STICKERSET_INVALID")) {
        ctx.reply("Error: Invalid sticker set name. Try a different name with /setstickername");
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    ctx.reply(`Error creating video sticker set: ${error.message}`);
  }
});
