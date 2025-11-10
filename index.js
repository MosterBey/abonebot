import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  Partials, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  Events, 
  ModalBuilder, 
  TextInputBuilder,
  TextInputStyle, 
  InteractionType 
} from "discord.js";
import Parser from "rss-parser";
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// -----------------------------
// ENV Değerleri
// -----------------------------
const channelId = process.env.CHANNEL_ID;
const roleId1 = process.env.ROLE_ID_1;
const roleId2 = process.env.ROLE_ID_2;
const adminRoleId = process.env.ADMIN_ROLE_ID;
const yesEmoji = process.env.YES_EMOJI;
const noEmoji = process.env.NO_EMOJI;
const logChannelId = process.env.LOG; // LOG kanalı
const replitURL = process.env.REPLIT_URL;
const ytChannelId = process.env.YT_CHANNEL_ID;
const ytDiscordChannelId = process.env.YT_DISCORD_CHANNEL;
const ytLogChannelId = process.env.YT_LOG_CHANNEL;
const mainGuildId = process.env.MAIN_GUILD_ID;
const otherGuildId = process.env.OTHER_GUILD_ID;

let lastVideoIdYT = null;

// -----------------------------
// LOG Fonksiyonu
// -----------------------------
client.log = async (id, options) => {
  const channel = await client.channels.fetch(id).catch(() => null);
  if (channel) channel.send(options);
};

// -----------------------------
// READY
// -----------------------------
client.once(Events.ClientReady, async () => {
  console.log("✅ Bot hazır ve YouTube sistemi aktif!");
  client.user.setActivity("YouTube/MosterDev", { type: 3 }); // WATCHING
  checkYouTube();
  setInterval(checkYouTube, 60 * 1000);
});

// -----------------------------
// Abone SS Event
// -----------------------------
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.channel.id !== channelId) return;
  if (message.attachments.size < 1) return;
  if (message.member.roles.cache.has(roleId1)) return;

  const yesBtn = new ButtonBuilder()
    .setCustomId("yes")
    .setStyle(ButtonStyle.Success)
    .setEmoji(yesEmoji)
    .setLabel("Onayla");

  const noBtn = new ButtonBuilder()
    .setCustomId("no")
    .setStyle(ButtonStyle.Danger)
    .setEmoji(noEmoji)
    .setLabel("Reddet");

  const row = new ActionRowBuilder().addComponents(yesBtn, noBtn);

  const embed = new EmbedBuilder()
    .setTitle("📸 Abone SS Kontrol")
    .setDescription(`**${message.author.tag}** adlı kullanıcı **abone SS** attı.\nAbone sorumlusu yetkililer en kısa sürede ilgilenecektir. Bekleyin.`)
    .setColor("#00bfff")
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Abone SS | ${new Date().toLocaleString()}` });

  const sentMsg = await message.channel.send({
    content: `<@&${adminRoleId}>`,
    embeds: [embed],
    components: [row],
  });

  const collector = sentMsg.createMessageComponentCollector({ time: 5 * 60 * 1000 });

  collector.on("collect", async (interaction) => {
    if (!interaction.member.roles.cache.has(adminRoleId))
      return interaction.reply({ content: "Yetkin yok!", ephemeral: true });

    if (interaction.customId === "yes") {
      await message.member.roles.add([roleId1, roleId2]);

      const approvedEmbed = new EmbedBuilder()
        .setTitle("✅ Abone Onaylandı")
        .setDescription(`Ekran görüntüsü **<@${interaction.user.id}>** tarafından **${new Date().toLocaleString()}** tarihinde onaylandı. Roller verildi.`)
        .setColor("#00ff00")
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

      await sentMsg.edit({ content: "", embeds: [approvedEmbed], components: [] });

      try { await message.author.send(`🎉 Abone SS'niz **<@${interaction.user.id}>** tarafından onaylandı! Rolleriniz verildi.`); } catch {}
      client.log(logChannelId, { embeds: [approvedEmbed] });

    } else if (interaction.customId === "no") {
      const modal = new ModalBuilder()
        .setCustomId(`reject_modal_${sentMsg.id}`)
        .setTitle("Abone SS Reddetme Formu");

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reddetme nedeni")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Sebebi yazın...")
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    }
  });
});

// -----------------------------
// Modal Interaction
// -----------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.type !== InteractionType.ModalSubmit) return;

  if (interaction.customId.startsWith("reject_modal_")) {
    const reason = interaction.fields.getTextInputValue("reason");
    const botMsgId = interaction.customId.replace("reject_modal_", "");
    const botMsg = await interaction.channel.messages.fetch(botMsgId).catch(() => null);
    if (!botMsg) return interaction.reply({ content: "Mesaj bulunamadı!", ephemeral: true });

    const userTag = botMsg.embeds[0]?.description?.match(/\*\*(.*?)\*\*/)?.[1] || "Bilinmiyor";

    const rejectedEmbed = new EmbedBuilder()
      .setTitle("❌ Abone Reddedildi")
      .setDescription(`Ekran görüntüsü **<@${interaction.user.id}>** tarafından **${new Date().toLocaleString()}** tarihinde reddedildi.\nSebep: ${reason}`)
      .setColor("#ff0000")
      .setThumbnail(botMsg.embeds[0]?.thumbnail?.url || null);

    await botMsg.edit({ content: "", embeds: [rejectedEmbed], components: [] });
    await interaction.reply({ content: "Reddetme işlemi başarıyla tamamlandı.", ephemeral: true });

    try {
      const user = interaction.guild.members.cache.find(m => m.user.tag === userTag)?.user;
      if (user) await user.send(`❌ Abone SS'niz **<@${interaction.user.id}>** tarafından reddedildi. Sebep: ${reason}`);
    } catch {}

    client.log(logChannelId, { embeds: [rejectedEmbed] });
  }
});

// -----------------------------
// GUILD MEMBER REMOVE
// -----------------------------
client.on(Events.GuildMemberRemove, async (member) => {
  if (member.guild.id !== mainGuildId) return;
  try {
    const otherGuild = await client.guilds.fetch(otherGuildId);
    const otherMember = await otherGuild.members.fetch(member.id).catch(() => null);
    if (otherMember) await otherMember.kick("Ana sunucudan ayrıldığı için atıldı.");

    try { await member.send("⚠️ Ana sunucu [MosterDev](https://discord.gg/Dby3exqq96) çıkış yaptığın tespit edildi, bu durum bizi gerçekten çok üzdü. MosterDev kurallar gereği eğer altyapılar sunucusunda var iseniz otomatik olarak atıldınız."); } catch {}

    const logEmbed = new EmbedBuilder()
      .setTitle("👤 Kullanıcı Çıkışı")
      .setDescription(`Ana sunucudan çıktığı için **${member.user.tag}** altyapılar sunucusundan atıldı.`)
      .setColor("#ffaa00")
      .setTimestamp();

    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (logChannel) logChannel.send({ embeds: [logEmbed] });

  } catch (err) {
    console.error("❌ Kullanıcı atılamadı:", err.message);
  }
});

// -----------------------------
// YouTube Duyuru Sistemi
// -----------------------------
async function checkYouTube() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ytChannelId}`);
    if (!feed.items?.length) return;
    const latest = feed.items[0];

    if (lastVideoIdYT && latest.id !== lastVideoIdYT) {
      const channel = await client.channels.fetch(ytDiscordChannelId);
      const logChannel = await client.channels.fetch(ytLogChannelId);

      const embed = new EmbedBuilder()
        .setTitle("📢 Yeni Video Yayında!")
        .setURL(latest.link)
        .setDescription(`🎬 **${latest.title}** yayında! [Hemen İzle](${latest.link})`)
        .setColor("#ff0000")
        .setThumbnail("https://cdn-icons-png.flaticon.com/512/1384/1384060.png")
        .setFooter({ text: "MosterDev - YouTube" });

      if (channel) await channel.send({ embeds: [embed] });
      if (logChannel) await logChannel.send(`🎬 Yeni Video Yayınlandı: **${latest.title}** - [Hemen İzle](${latest.link}) @everyone`);
    }

    lastVideoIdYT = latest.id;
  } catch (err) {
    console.error("❌ YouTube kontrol hatası:", err.message);
  }
}

// -----------------------------
// Ana sunucudan ayrılanları oto ban kontrolü
// -----------------------------
async function checkMemberSync() {
  let bannedCount = 0; // ✅ Ban sayacı
  try {
    const mainGuild = await client.guilds.fetch(mainGuildId);
    const otherGuild = await client.guilds.fetch(otherGuildId);

    const mainMembers = await mainGuild.members.fetch();
    const otherMembers = await otherGuild.members.fetch();

    for (const [id, otherMember] of otherMembers) {
      if (!mainMembers.has(id)) {
        try {
          // 📨 Kullanıcıya DM gönder
          try {
            await otherMember.send(
              "⚠️ Ana sunucu **[MosterDev](https://discord.gg/Dby3exqq96)**'den ayrıldığın tespit edildi. Kurallar gereği, bağlı yan sunuculardan otomatik olarak yasaklandın."
            );
          } catch {}

          // 🚫 Ban işlemi
          await otherMember.ban({ reason: "Ana sunucuda bulunmadığı için otomatik banlandı." });
          bannedCount++;

          // 📋 Log kanalı bildirimi
          const logEmbed = new EmbedBuilder()
            .setTitle("🚫 Otomatik Ban")
            .setDescription(`**${otherMember.user.tag}** ana sunucuda bulunmadığı için yan sunucudan otomatik olarak banlandı.`)
            .setColor("#ff0000")
            .setTimestamp();

          const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
          if (logChannel) await logChannel.send({ embeds: [logEmbed] });

        } catch (err) {
          console.error(`❌ ${otherMember.user.tag} banlanamadı:`, err.message);
        }
      }
    }

    return bannedCount; // ✅ Fonksiyon sonunda toplam ban sayısını döndür
  } catch (err) {
    console.error("❌ checkMemberSync hatası:", err.message);
    return bannedCount;
  }
}

// -----------------------------
// Express + Uptime
// -----------------------------
const app = express();
app.get("/", (req, res) => res.status(200).send("Bot aktif 🚀"));
app.listen(3000, () => console.log("🌍 Express sunucusu açık (3000 port)"));

// 🟢 PING + OTO BAN sistemi
setInterval(async () => {
  try {
    await axios.get(replitURL, { validateStatus: false });
    const bannedCount = await checkMemberSync();
    console.log(`🚀 Ping atıldı (${new Date().toLocaleTimeString()}) | Yan sunucudan banlanan: ${bannedCount}`);
  } catch (err) {
    console.log("❌ Ping atılamadı:", err.message);
  }
}, 60 * 1000);

// -----------------------------
// .abone Komutu (manuel onay)
// -----------------------------
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(".abone")) return;

  if (!message.member.roles.cache.has(adminRoleId)) {
    return message.reply("❌ Bu komutu sadece **abone sorumluları** kullanabilir!");
  }

  const target = message.mentions.members.first();
  if (!target) return message.reply("⚠️ Lütfen bir kullanıcı etiketleyin! Örnek: `.abone @kullanıcı`");

  try {
    await target.roles.add([roleId1, roleId2]);

    const embed = new EmbedBuilder()
      .setTitle("✅ Abone Rolü Verildi")
      .setDescription(`**${target.user.tag}** adlı kullanıcıya abone rolü **<@${message.author.id}>** tarafından verildi. **${new Date().toLocaleString()}** tarihinde onaylandı. Roller verildi.`)
      .setColor("#00ff00")
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `MosterDev • ${new Date().toLocaleString()}` });

    await message.react("✅");

    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (logChannel) await logChannel.send({ embeds: [embed] });

    try {
      await target.send("🎉 Tebrikler! Abone SS'in onaylandı ve abone rollerin verildi. İyi eğlenceler!");
    } catch {}

  } catch (err) {
    console.error("❌ Abone rolü verilemedi:", err);
    message.reply("⚠️ Rol verirken bir hata oluştu!");
  }
});

client.login(process.env.TOKEN);
