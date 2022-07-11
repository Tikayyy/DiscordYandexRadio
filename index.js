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
let resource = null;
let music = [];
let sounded = 0;
let messageVar = null;

const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES"]
});

client.on("messageCreate", async function (message) {
    if (message.author.bot || !message.content.startsWith(prefix)) {
        return;
    }

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    if (message.author.tag === "ELan#5744") {
        await message.reply("Все еще не поздно сгонять за хлебом");
    }

    messageVar = messageVar === null ? message : messageVar;

    switch (command) {
        case "play":
            await yandexPlay(args);
            break
        case "stop":
            yandexStop();
            break;
        case "skip":
            yandexSkip();
            break;
        case "queue":
            yandexQueue();
            break;
        default:
            await messageVar.reply('Такой команды нет, еблан');
            break;
    }
});

client.login(config.BOT_TOKEN);

async function yandexPlay(args) {
    let link = args[0];
    let segments =  link.split('/');
    let id = segments[segments.length - 1];
    let type = segments[segments.length - 2];

    try {
        if (!link.includes('https://music.yandex.ru/')) {
            let query = '';
            args.forEach(function (word) {
                query += word + ' ';
            });
            query = encodeURIComponent(query);
            let search = await api.searchTracks(query);
            let track = search.tracks.results[0];

            playTrack(track.id)

            return;
        }

        if (type === 'track') {
            playTrack(id);
        } else if (type === 'album') {
            let album = await api.getAlbum(id, true);
            album.volumes[0].sort(function (a, b) {
                if (a.id > b.id) {
                    return -1;
                } else if (a.id < b.id) {
                    return 1;
                } else {
                    return 0;
                }
            }).forEach(function (track) {
                playTrack(track.id);
            });
        } else if (type === 'playlists') {
            let user = segments[segments.length - 3];
            let playlist = await api.getPlaylist(id, user);
            playlist.tracks.forEach(function (track) {
                playTrack(track.id);
            });
        } else {
            messageVar.reply("Кинь нормальную ссылку, кожанный пидрилла");
        }

    } catch (e) {
        console.log(`api error ${e.message}`);
        messageVar.channel.send('Error');
    }
}

function yandexStop() {
    const connection = connect(messageVar);
    connection.destroy();
}

function yandexSkip() {
    audioPlayer.stop(true);
}

async function playTrack(id) {
    const connection = connect(messageVar);

    try {
        await api.init({ username: config.YANDEX_EMAIL, password: config.YANDEX_PASSWORD });

        const downloadInfo = await api.getTrackDownloadInfo(id);
        const trackLink = await api.getTrackDirectLink(downloadInfo[0].downloadInfoUrl);

        let track = downloadedTracksDir.replace('audio', id);
        fs.exists(track, function(isExist) {
            if (!isExist) {
                let file = fs.createWriteStream(track);
                let request = https.get(trackLink, function(response) {
                    response.pipe(file);
                });
            }
        });

        const trackInfo = await api.getTrack(id);

        music.push({
            'path': track,
            'title': trackInfo[0].artists[0].name + " - " + trackInfo[0].title
        });

        if (audioPlayer.state.status !== 'playing' && audioPlayer.state.status !== 'buffering') {
            let currentTrack = music.shift();
            sounded = currentTrack['path'];

            messageVar.channel.send(currentTrack['title']);

            resource = createAudioResource(sounded);
            audioPlayer.play(resource);
            const subscription = connection.subscribe(audioPlayer);

            audioPlayer.on('idle', async function () {
                await yandexNext();
            });
        }
    } catch (e) {
        console.log(`api error ${e.message}`);
    }
}

async function yandexNext() {
    if (music.length  === 0) {
        await deleteTrack();
        return;
    }

    let currentTrack = music.shift();
    resource = createAudioResource(currentTrack['path']);

    audioPlayer.play(resource);

    messageVar.channel.send(currentTrack['title']);

    if (sounded !== 0) {
        await deleteTrack(currentTrack['path']);
    }
}

function yandexQueue() {
    music.forEach(function (track) {
        messageVar.channel.send(track.title);
    });
}

async function deleteTrack(next = false) {
    setTimeout(function() {
        fs.unlink(sounded, function (error) {
            if (error) {
                console.log(error.message);
            } else {
                console.log('File removed: ' + sounded);
            }
        });

        sounded = next !== false ? next : 0;
    }, 5000);
}

function connect() {
    let channel = messageVar.member.voice.channel;
    return DiscordVoice.joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });
}