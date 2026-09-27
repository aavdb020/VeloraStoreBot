const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
const http = require('http');

// ==========================================
// 1. DUMMY WEBSERVER VOOR RENDER PORT BINDING
// ==========================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Velora Store Bot is Online!');
    res.end();
}).listen(PORT, () => {
    console.log(`🌐 Webserver actief op poort ${PORT}`);
});

// ==========================================
// 2. DISCORD CLIENT CONFIGURATIE
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// 3. SLASH COMMANDS
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('store-panel')
        .setDescription('Plaats het Velora Store winkelpaneel'),
    
    new SlashCommandBuilder()
        .setName('prijslijst')
        .setDescription('Bekijk het aanbod en de prijzen van Velora Store'),

    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Bekijk de snelheid van de bot')
].map(cmd => cmd.toJSON());

// ==========================================
// 4. BOT READY EVENT
// ==========================================
client.once('clientReady', async () => {
    console.log(`🛒 [VELORA STORE] Bot is succesvol ingelogd als ${client.user.tag}!`);
    
    client.user.setPresence({
        activities: [{ name: 'Velora Store • /prijslijst' }],
        status: 'online'
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 Slash commands worden geregistreerd...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash commands geladen!');
    } catch (err) {
        console.error('❌ Fout bij laden slash commands:', err);
    }
});

// ==========================================
// 5. INTERACTIES (COMMANDS & TICKETS)
// ==========================================
client.on('interactionCreate', async (interaction) => {

    // === SLASH COMMANDS ===
    if (interaction.isChatInputCommand()) {
        const { commandName, member, guild, channel } = interaction;
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (commandName === 'store-panel') {
            if (!isAdmin) {
                return interaction.reply({ content: '❌ Alleen beheerders kunnen het winkelpaneel plaatsen.', ephemeral: true });
            }

            const storeEmbed = new EmbedBuilder()
                .setTitle('🛍️ Welkom bij Velora Store')
                .setDescription(
                    'Kies hieronder wat je wilt doen!\n\n' +
                    '📺 **Netflix Account Premium**\n' +
                    '🚀 **Discord Server Boosts**\n' +
                    '🎵 **Spotify Premium Accounts**\n\n' +
                    'Wil je bestellen of heb je een vraag? Klik op de knop hieronder om een ticket te openen!'
                )
                .setColor('#5865F2')
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setFooter({ text: 'Velora Store • Quality & Fast Service', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            const buyButton = new ButtonBuilder()
                .setCustomId('open_order_ticket')
                .setLabel('Bestelling / Vraag Openen')
                .setEmoji('🛒')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(buyButton);

            await channel.send({ embeds: [storeEmbed], components: [row] });
            return interaction.reply({ content: '✅ Winkelpaneel succesvol geplaatst!', ephemeral: true });
        }

        if (commandName === 'prijslijst') {
            const priceEmbed = new EmbedBuilder()
                .setTitle('💎 Velora Store — Prijslijst & Aanbod')
                .setColor('#5865F2')
                .addFields(
                    { name: '📺 Netflix Premium', value: '• 1 Maand Account: **€3,50**\n• 3 Maanden Account: **€8,00**', inline: false },
                    { name: '🚀 Discord Boosts', value: '• 14x Server Boosts (3 Maanden): **€7,50**\n• 14x Server Boosts (1 Maand): **€4,00**', inline: false },
                    { name: '🎵 Spotify Premium', value: '• Individual Account (1 Maand): **€2,50**\n• Lifetime Upgrade: **€10,00**', inline: false }
                )
                .setFooter({ text: 'Velora Store • Prijzen kunnen wijzigen', iconURL: guild.iconURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [priceEmbed] });
        }

        if (commandName === 'ping') {
            return interaction.reply({ content: `🏓 Pong! Latency is **${client.ws.ping}ms**.` });
        }
    }

    // === KNOPPEN & TICKETS ===
    if (interaction.isButton()) {
        const { guild, user, customId, channel } = interaction;

        if (customId === 'open_order_ticket') {
            const channelName = `bestelling-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            const existingChannel = guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) {
                return interaction.reply({ content: `❌ Je hebt al een bestelticket openstaan: ${existingChannel}`, ephemeral: true });
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        {
                            id: user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks
                            ]
                        },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                    ]
                });

                const orderEmbed = new EmbedBuilder()
                    .setTitle(`🛒 Bestelticket — Velora Store`)
                    .setDescription(
                        `Welkom ${user}!\n\n` +
                        `Laat ons hieronder weten wat je wilt bestellen:\n` +
                        `• **Product:** (bijv. Netflix / Discord Boosts / Spotify)\n` +
                        `• **Aantal / Duur:**\n` +
                        `• **Betaalmethode:** (bijv. Tikkie / PayPal / Crypto / Paysafecard)\n\n` +
                        `Een medewerker helpt je zo snel mogelijk verder!`
                    )
                    .setColor('#5865F2')
                    .setTimestamp();

                const closeBtn = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Sluit Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(closeBtn);

                await ticketChannel.send({ content: `${user} Welkom!`, embeds: [orderEmbed], components: [row] });
                return interaction.reply({ content: `✅ Je ticket is aangemaakt: ${ticketChannel}`, ephemeral: true });

            } catch (err) {
                console.error(err);
                return interaction.reply({ content: '❌ Fout bij het aanmaken van het ticket.', ephemeral: true });
            }
        }

        if (customId === 'close_ticket') {
            await interaction.reply('🔒 Dit ticket wordt over 5 seconden gesloten...');
            setTimeout(() => {
                channel.delete().catch(() => {});
            }, 5000);
        }
    }
});

// ==========================================
// 6. INLOGGEN
// ==========================================
client.login(process.env.DISCORD_TOKEN);
