const Discord = require("discord.js");
const DiscordVoice = require('@discordjs/voice');
const {
    createAudioPlayer,
    createAudioResource
} = require("@discordjs/voice");

const {
    YMApi
} = require('ym-api');
const api = new YMApi();

const config = require("./config.json");
const fs = require("fs");
const https = require("https");

const prefix = '@';
const downloadedTracksDir = "C:\\Users\\Tikay\\Desktop\\discord.ya\\tmp-music\\audio.mp3";
const audioPlayer = createAudioPlayer();
var music = [];
var sounded = '';
var messageVar = null;

const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES"]
});

client.on("messageCreate", function(message) {
    if (message.author.bot || !message.content.startsWith(prefix)) {
        return;
    }

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    if (message.author.tag === "ELan#5744") {
        message.reply("Все еще не поздно сгонять за хлебом");
    }

    if (messageVar === null) {
        messageVar = message;
    }

    switch (command) {
        case "play":
            yandexPlay(args);
            break
        case "stop":
            yandexStop()
            break;
        case "skip":
            yandexSkip();
            break;
        default:
            messageVar.reply('Такой команды нет, еблан');
            break;
    }
});

client.login(config.BOT_TOKEN);

function yandexPlay(args) {
    var link = args[0];
    var segments =  link.split('/');
    var id = segments[segments.length - 1];
    var type = segments[segments.length - 2];

    if (type === 'track') {
        playTrack(id);
    } else if (type === 'album') {
        (async () => {
            try {
                var album = await api.getAlbum(id, true);
                album.volumes[0].forEach(function (track) {
                    playTrack(track.id);
                });
            } catch (e) {
                console.log(`api error ${e.message}`);
            }
        })();
    } else if (type === 'playlists') {
        (async () => {
            try {
                var user = segments[segments.length - 3];
                var playlist = await api.getPlaylist(id, user);
                playlist.tracks.forEach(function (track) {
                    playTrack(track.id);
                });
            } catch (e) {
                console.log(`api error ${e.message}`);
            }
        })();
    } else {
        messageVar.reply("Кинь нормальную ссылку, кожанный пидрилла");
    }
}

function yandexStop() {
    const connection = connect(messageVar);
    connection.destroy();
}

function yandexSkip() {
    if (music.length > 0) {
        const resource = createAudioResource(music.shift());
        audioPlayer.play(resource);
    }
}

function playTrack(id) {
    const connection = connect(messageVar);

    (async () => {
        try {
            await api.init({ username: config.YANDEX_EMAIL, password: config.YANDEX_PASSWORD });

            const downloadInfo = await api.getTrackDownloadInfo(id);
            const trackLink = await api.getTrackDirectLink(downloadInfo[0].downloadInfoUrl);

            var track = downloadedTracksDir.replace('audio', id);
            fs.exists(track, function(isExist) {
                if (!isExist) {
                    var file = fs.createWriteStream(track);
                    var request = https.get(trackLink, function(response) {
                        response.pipe(file);
                    });
                }
            });

            const trackInfo = await api.getTrack(id);
            messageVar.channel.send(trackInfo[0].artists[0].name + " - " + trackInfo[0].title);

            music.push(track);
            sounded = track;
            if (audioPlayer.state.status !== 'playing' && audioPlayer.state.status !== 'buffering') {
                const resource = createAudioResource(music.shift());
                audioPlayer.play(resource);
                const subscription = connection.subscribe(audioPlayer);

                audioPlayer.on('idle', function () {
                    if (music.length > 0) {
                        const resource = createAudioResource(music.shift());
                        audioPlayer.play(resource);
                    }
                });
            }
        } catch (e) {
            console.log(`api error ${e.message}`);
        }
    })();
}

function connect() {
    var channel = messageVar.member.voice.channel;
    return DiscordVoice.joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });
}