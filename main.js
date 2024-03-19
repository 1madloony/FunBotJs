//#region Variables

const { joinVoiceChannel, createAudioResource, createAudioPlayer } = require('@discordjs/voice');
const Discord = require('discord.js');
const keep_alive = require('./keep_alive.js')
const { join } = require('node:path');
const request = require('request');
require('dotenv').config();

const options = {
  url: 'https://api.alerts.in.ua/v1/alerts/active.json',
    headers: {
    'Authorization': `Bearer ${process.env.alertToken}`
  }
};

const permanentNickname = ". ZV";

const usersRetries = new Map();
const retriesCount = 3;

const alertRegions = [31, 14];
let alertInterval;
let alertActive = false;
let guild_safe;

const guildId = 1113221021579890808;

//#endregion

//#region Functions

function alertActivated(guild) // Play sound on alert activated
{
    let channels = guild.channels.cache.values(); 

    let max = -1;
    let max_id = -1;
    for(let channel of channels)
    {
      if(channel.type === 2)
      {
        if(channel.members.size > max)
        {
          max = channel.members.size;
          max_id = channel.id;
        }
      }
    }

    if(max == 0) return;

    let alertVoice = joinVoiceChannel({
      channelId: max_id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
  });

  let resource = createAudioResource(join(__dirname, 'alert_active.mp3'));
  const player = createAudioPlayer();
  
  player.on('error', error => {
    console.error(`Error: ${error.message}`);
  });
  
  player.play(resource, {seek: 0, volume: 1});
  var sub = alertVoice.subscribe(player);
  
  if(sub)
  {
    setTimeout(() => {
      sub.unsubscribe();
      alertVoice.disconnect();
    }, 15000);
  }
}

function alertDeactivated(guild) // Play sound on alert deactivated
{
    let channels = guild.channels.cache.values(); 

    let max = -1;
    let max_id = -1;
    for(let channel of channels)
    {
      if(channel.type === 2)
      {
        if(channel.members.size > max)
        {
          max = channel.members.size;
          max_id = channel.id;
        }
      }
    }

    if(max == 0) return;

    let alertVoice = joinVoiceChannel({
      channelId: max_id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
  });

  let resource = createAudioResource(join(__dirname, 'alert_deactive.mp3'));
  const player = createAudioPlayer();
  
  player.on('error', error => {
    console.error(`Error: ${error.message}`);
  });
  
  player.play(resource, {seek: 0, volume: 1});
  var sub = alertVoice.subscribe(player);
  
  if(sub)
  {
    setTimeout(() => {
      sub.unsubscribe();
      alertVoice.disconnect();
    }, 17000);
  }
}

function StringDate()
{
  let dateNow = new Date();
  return dateNow.toUTCString();
}

//#endregion

//#region Discord

const client = new Discord.Client({
    intents: [
      Discord.GatewayIntentBits.Guilds,
      Discord.GatewayIntentBits.GuildMessages,
      Discord.GatewayIntentBits.GuildPresences,
      Discord.GatewayIntentBits.GuildMembers,
      Discord.GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
      Discord.Partials.Channel,
      Discord.Partials.GuildMember,
      Discord.Partials.GuildScheduledEvent,
      Discord.Partials.Message,
      Discord.Partials.Reaction,
      Discord.Partials.ThreadMember,
      Discord.Partials.User
    ]
  });
  
  client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on('guildAvailable', (guild) => {
    if(guild.id != guildId) return;
    alertInterval = setInterval(()=>{
        request.get(options, (error, response, body) => {
          if (error) {
            console.error(error);
            return;
          }

          let obj = JSON.parse(body);
          let currentActive = false;

          for(let alert of obj.alerts)
          {
            if(alertRegions.includes(alert.location_oblast_uid))
            { 
              currentActive = true;
            }
          }

          if(!alertActive && currentActive)
          {
            alertActive = true;
            alertActivated(guild);
          }

          if(alertActive && !currentActive)
          {
            alertActive = false;
            alertDeactivated(guild);
          }
      });
      }, 45000);
  });

client.on('guildMemberUpdate', (oldMember, newMember) => {

    try
    {
      if ( oldMember.id == 340039442406572034 && oldMember.nickname !== newMember.nickname)
        {
          newMember.guild.fetchAuditLogs({
            type: Discord.AuditLogEvent.MemberUpdate
          }).then(audit => {
            const { executor } = audit.entries.first();
            const executorId = executor.id;

            if(usersRetries.has(executorId))
            {
              const currentRetries = usersRetries.get(executorId);

              if (currentRetries < retriesCount - 1) {
                usersRetries.set(executorId, currentRetries + 1);
                console.log(`<${StringDate()}> Increased retries for user ${executorId} to ${currentRetries + 1}`);
              } else {
                usersRetries.delete(executorId);
                console.log(`<${StringDate()}> Maximum retries reached for user ${executorId}`);
              
                client.users.fetch(executorId, false).then((user) => {
                  user.send({files: ['https://memepedia.ru/wp-content/uploads/2023/08/sizif-mem.jpg']});
                  user.send(`<@${executorId}>`);
                });
              }
            } else 
            {
              if(executorId != 1217957406655512648)
              {
                usersRetries.set(executorId, 1);
              }
            }

            });

          newMember.setNickname(permanentNickname);
          console.log('<' + StringDate() + '> refreshed nickname ' + newMember.nickname);


        }
    } catch (ex)
    {
        console.log('<' + StringDate() + '> Error: ' + ex);
    }
});

  client.login(process.env.discordToken);

//#endregion
