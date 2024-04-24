#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var player = require('chromecast-player')();
var chalk = require('chalk');
var keypress = require('keypress');
var ui = require('playerui')();
var circulate = require('array-loop');
var shuffle = require('array-shuffle');
var unformatTime = require('./utils/unformat-time');
var debug = require('debug')('castnow');
var debouncedSeeker = require('debounced-seeker');
var mime = require('mime');
var btoa = require( "btoa" );
var getUri = require( "get-uri" );
var _ = require( "lodash" );
var mm = require( "music-metadata" );
var sharp = require( "sharp" );
var noop = function() {};

// plugins
var directories = require('./plugins/directories');
var xspf = require('./plugins/xspf');
var localfile = require('./plugins/localfile');
var torrent = require('./plugins/torrent');
var transcode = require('./plugins/transcode');
var subtitles = require('./plugins/subtitles');
var stdin = require('./plugins/stdin');

var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var rcOpts = [];
try {
  rcOpts = fs.readFileSync(path.join(home, '.castnowrc')).toString().trim().split(/\s+/);
} catch(err) {}

var optConfig = {
  boolean: "tomp4 quiet bypass-srt-encoding loop shuffle recursive exit help showoptions metadata showmetadata showcover".split(/\s+/),
  string: "device address subtitles subtitle-scale subtitle-color subtitle-port myip type seek volume-step localfile-port transcode-port torrent-port stdin-port command".split(/\s+/),
  default: {
    metadata: true,
    showcover: true
  }
}
var args = rcOpts.concat(process.argv.slice(2));
var opts = require('minimist')(args, optConfig);

// Eliminate duplicate option values, prefering the final option value.
for (var opt in opts) {
  if (opts.hasOwnProperty(opt) && opt[0].toLowerCase() != opt[0].toUpperCase() && Array.isArray(opts[opt]))
    opts[opt] = opts[opt].pop()
}

if (opts.help) {
  return console.log([
    '',
    'Usage: castnow [<media>, <media>, ...] [OPTIONS]',
    '',
    'Option                   Meaning',
    '--tomp4                  Convert media to mp4 during playback',
    '--device <name>          The name of the Chromecast device that should be used',
    '--address <ip>           The IP address or hostname of your Chromecast device',
    '--subtitles <path/url>   Path or URL to an SRT or VTT file',
    '--subtitle-scale <scale> Subtitle font scale',
    '--subtitle-color <color> Subtitle font RGBA color',
    '--subtitle-port <port>   Specify the port to be used for serving subtitles',
    '--myip <ip>              Your local IP address',
    '--quiet                  No output',
    '--peerflix-* <value>     Pass options to peerflix',
    '--ffmpeg-* <value>       Pass options to ffmpeg',
    '--type <type>            Explicitly set the mime-type (e.g. "video/mp4")',
    '--bypass-srt-encoding    Disable automatic UTF-8 encoding of SRT subtitles',
    '--seek <hh:mm:ss>        Seek to the specified time on start using the format hh:mm:ss or mm:ss',
    '--loop                   Loop over playlist, or file, forever',
    '--shuffle                Play in random order',
    '--recursive              List all media in directories recursively',
    '--volume-step <step>     Step at which the volume changes. Helpful for speakers that are softer or louder than normal. Value ranges from 0 to 1 (e.g. ".05")',
    '--localfile-port <port>  Specify the port to be used for serving local media',
    '--transcode-port <port>  Specify the port to be used for serving transcoded media',
    '--torrent-port <port>    Specify the port to be used for serving torrented media',
    '--stdin-port <port>      Specify the port to be used for serving media read from stdin',
    '--metadata false         Do not attempt to retrieve metadata from audio media',
    '--showmetadata           Show metadata',
    '--showcover false        Do not show cover art on console',
    '--showoptions            Show values for options',
    '--command <key1>,<key2>  Execute key command(s) (where each <key> is one of the keys listed below)',
    '--exit                   Exit when playback begins or --command completes',
    '--help                   This help screen',
    '',
    'Player controls',
    '',
    'Key                      Action',
    'space                    Toggle between play and pause',
    'm                        Toggle mute',
    't                        Toggle subtitles',
    'up                       Volume Up',
    'down                     Volume Down',
    'left                     Seek backward',
    'right                    Seek forward',
    'p                        Previous in playlist',
    'n                        Next in playlist',
    's                        Stop playback',
    'quit                     Quit',
    ''
  ].join('\n'));
}

if (opts._.length) {
  opts.playlist = opts._.map( function( media ) {
    return {
      path: media,
      contentUrl: media
    };
  });
}

delete opts._;

if (opts.quiet || opts.exit || process.env.DEBUG) {
  ui.hide();
}

var volumeStep = 0.05;
var stepOption = opts['volume-step'];

if (stepOption) {
  var parsed = parseFloat(stepOption);

  if (isNaN(parsed)) {
    fatalError('invalid --volume-step');
  }

  if (parsed < 0 || parsed > 1) {
    fatalError('--volume-step must be between 0 and 1');
  }

  volumeStep = parsed;
}

debug('volume step: %s', volumeStep);

ui.showLabels('state');

function fatalError(err) {
  ui.hide(err);
  debug(err);
  console.log(chalk.red(err));
  process.exit();
}

function getPicture( media ) {
  try {
    return media.audioMetadata.common.picture[0].data
  }
  catch( err ) {
    return undefined;
  }
}

function pictureToConsole( image, bottom ) {
  return new Promise( ( resolve, reject ) => {
    if ( !image ){
      return resolve( image );
    }
    sharp( image ).resize( {
      fit: "inside",
      height: process.stdout.rows * 2 - 8,
      width: process.stdout.columns
    } )
    .raw()
    .toBuffer( { resolveWithObject: true } )
    .then( ( { data, info } ) => {
      data = new Uint8Array( data );
      const lineWidth = info.width * info.channels;
      const lines = [];
      const fgc = {};
      const bgc = {};

      for( let y = 0; y < info.height - 1; y += 2 ) {
        const c = data.slice( lineWidth * y, lineWidth * ( y + 2 ) );
        const line = c.slice( 0, lineWidth );
        const nextLine = c.slice( lineWidth, lineWidth * 2 );

        let pixels = [];
        for( let idx = 0; idx < lineWidth; idx += info.channels ) {
          const bgr = line[ idx ], bgg = line[ idx + 1 ], bgb = line[ idx + 2 ];
          const bgKey = bgr << 16 | bgg << 8 | bgb;
          let bg = bgc[ bgKey ];
          if( !bg ) {
            bg = chalk.bgRgb( bgr, bgg, bgb )( "_" ).split( "_" )[ 0 ];
            bgc[ bgKey ] = bg;
          }
          const fgr = nextLine[ idx ], fgg = nextLine[ idx + 1 ], fgb = nextLine[ idx + 2 ];
          const fgKey = fgr << 16 | fgg << 8 | fgb;
          let fg = fgc[ fgKey ];
          if( !fg ) {
            fg = chalk.rgb( fgr, fgg, fgb )( "▄" );
            fgc[ fgKey ] = fg;
          }
          pixels.push( bg + fg );
        }
        lines.push( pixels.join( "" ) );
      }
      console.log();
      console.log( chalk.reset( lines.join( chalk.reset( "\n" ) ) ) );
      if( bottom ) {
        console.log( "\n".repeat( bottom - 1 ) );
      }
      return resolve();
    } )
  } )
}

// Limit image data to fit arbitrary protobuffer size of 64k.
const maxSize = 32000;

// Extract image and reduce until it fits the buffer size.
async function processImage( data ) {
  var size = data.length * 4 / 3;
  return await sharp( data )
  .metadata()
  .then( metadata => {
    const resize = {
      execute: size > maxSize || metadata.height > 512 || metadata.width > 512,
      i: 0,
      fit: "inside",
      height: Math.min( 512, metadata.height ),
      width: Math.min( 512, metadata.width )
    }

    return resize;
  } ).then( async resize => {
    const result = {};
    do {
      const image = sharp( data );
      if( resize.execute ) {
        image.resize( resize );
      }

      await image
      .jpeg()
      .toBuffer()
      .then( newImage => {
        if( 0 === resize.i ) {
          result.local = newImage
        }
        result.remote = "data:image/jpg;base64, " + btoa( newImage )
      } );
      resize.height -= 16;
      resize.width -= 16;
      resize.size = result.remote.length;
    } while( resize.size > maxSize && resize.i++ < 32 )
    return result;
  } )
}

function getMetadata( media ) {
  return new Promise( ( resolve, reject ) => {
    // Only do this once per media item.
    if ( !media || media.audioMetadata ) {
      return resolve( media );
    };
    media.audioMetadata = {};

    getUri( encodeURI( decodeURIComponent( media.contentUrl ) ), {}, ( err, stream ) => {
      if ( err ) {
        return reject( err );
      };
      mm.parseStream( stream ).then( async metadata => {
        media.audioMetadata = metadata;
        const mc = metadata.common;
        media.metadata = {
          metadataType: 3,
          albumName: mc.album,
          artist: mc.artist,
          title: mc.title
        }
        if ( Array.isArray( mc.picture ) && mc.picture[0] ) {
          await processImage( mc.picture[ 0 ].data ).then( result => {
            mc.picture[ 0 ].data = result.local;
            media.metadata.images = [ { url: result.remote } ];
          } );
        }
        return resolve( media );
      } )
    } )
  } )
}

var last = function(fn, l) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    args.push(l);
    l = fn.apply(null, args);
    return l;
  };
};

var ctrl = function(err, p, ctx) {
  if (err) {
    ui.hide();
    debug('player error: %o', err);
    console.log(chalk.red(err));
    process.exit();
  }

  var playlist = ctx.options.playlist || [];
  var playlist_history = ctx.options.playlist_history || [];
  var volume;
  var is_keyboard_interactive = process.stdin.isTTY || false;

  if (is_keyboard_interactive) {
    keypress(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  ctx.once('closed', function() {
    ui.hide();
    console.log(chalk.red('lost connection'));
    process.exit();
  });

  // get initial volume
  p.getVolume(function(err, status) {
    volume = status;
  });

  if (!ctx.options.disableTimeline) {
    p.on('position', function(pos) {
      ui.setProgress(pos.percent);
      ui.render();
    });
  }

  var seekImmediate = function(offset) {
    if (ctx.options.disableSeek || offset === 0) return;
    var seconds = Math.max(0, (p.getPosition() / 1000) + offset);
    debug('seeking to %s', seconds);
    p.seek(seconds);
  };

  if (opts.exit) {
    // cannot debounce or seek never executes before we exit
    var seek = seekImmediate;
  } else {
    var seek = debouncedSeeker(function(offset) {
      // handles seeking offset = seconds
      seekImmediate(offset);
    }, 500);
  }

  var updateTitle = function() {
    p.getStatus(function(err, status) {
      if (!status || !status.media ||
          !status.media.metadata ||
          !status.media.metadata.title) return;

      var metadata = status.media.metadata;
      var title = metadata.title;
      title = ( metadata.artist ? metadata.artist + " - " : "" ) + title;
      title = title + ( metadata.album ? " (" + metadata.album + ")" : "" );

      ui.setLabel( 'source', 'Source', title );
      ui.showLabels( 'state', 'source' );
      ui.render();
    });
  };

  var initialSeek = function() {
    var seconds = unformatTime(ctx.options.seek);
    debug('seeking to %s', seconds);
    p.seek(seconds);
  };

  p.on('playing', updateTitle);

  if (!ctx.options.disableSeek && ctx.options.seek) {
    p.once('playing', initialSeek);
  }

  updateTitle();

  var nextInPlaylist = function() {
    if (ctx.mode !== 'launch') return;
    if (!playlist.length) return process.exit();
    p.stop( async function() {
      ui.showLabels('state');
      const media = playlist.shift();
      debug( 'loading next in playlist: %o', media );
      await pictureToConsole( getPicture( media ), 3 );
      p.load( { media: _.pick( media, "contentId", "contentUrl", "contentType", "metadata" ) }, noop );

      if (ctx.options.loop)
        playlist.push( media );
      else
        playlist_history.push( media );
    });
  };

  var previousInPlaylist = function() {
    if (ctx.options.loop) {
      playlist.unshift(playlist.pop());
      playlist.unshift(playlist.pop());
      nextInPlaylist();
    }
    else if (0 < playlist_history.length) {
      playlist.unshift(playlist_history.pop());
      if (0 < playlist_history.length) playlist.unshift(playlist_history.pop());
      nextInPlaylist();
    }
  };

  p.on('status', last(function(status, memo) {
    if (opts.exit && status.playerState == 'PLAYING') process.exit();
    if (status.playerState !== 'IDLE') return;
    if (status.idleReason !== 'FINISHED') return;
    if (memo && memo.playerState === 'IDLE') return;
    nextInPlaylist();
    return status;
  }));

  var keyMappings = {

    // toggle between play / pause
    space: function() {
      if (p.currentSession.playerState === 'PLAYING') {
        p.pause();
      } else if (p.currentSession.playerState === 'PAUSED') {
        p.play();
      }
    },

    // toggle between mute / unmute
    m: function() {
      if(!volume) {
        return;
      } else if (volume.muted) {
        p.unmute(function(err, status) {
          if (err) return;
          volume = status;
        });
      } else {
        p.mute(function(err, status) {
          if (err) return;
          volume = status;
        });
      }
    },

    t: function() {
      if (!p.currentSession.media.tracks) { return }
      var sessionRequestBody = {
        type: 'EDIT_TRACKS_INFO'
      }
      sessionRequestBody.activeTrackIds = p.currentSession.activeTrackIds ? [] : [1];
      p.sessionRequest(sessionRequestBody);
    },

    // volume up
    up: function() {
      if (!volume || volume.level >= 1) {
        return;
      }

      var newVolume = Math.min(volume.level + volumeStep, 1);

      p.setVolume(newVolume, function(err, status) {
        if (err) {
          return;
        }

        debug("volume up: %s", status.level);

        volume = status;
      });
    },

    // volume down
    down: function() {
      if (!volume || volume.level <= 0) {
        return;
      }

      var newVolume = Math.max(volume.level - volumeStep, 0);

      p.setVolume(newVolume, function(err, status) {
        if (err) {
          return;
        }

        debug("volume down: %s", status.level);

        volume = status;
      });
    },

    // next media in playlist
    n: function() {
      nextInPlaylist();
    },

    // previous media in playlist
    p: function() {
      previousInPlaylist();
    },

    // stop playback
    s: function() {
      p.stop();
    },

    // quit
    q: function() {
      process.exit();
    },

    // Rewind, one "seekCount" per press
    left: function() {
      seek(-30);
    },

    // Forward, one "seekCount" per press
    right: function() {
      seek(30);
    }
  };

  if (is_keyboard_interactive) {
    process.stdin.on('keypress', function(ch, key) {
      if (key && key.name && keyMappings[key.name]) {
        debug('key pressed: %s', key.name);
        keyMappings[key.name]();
      }
      if (key && key.ctrl && key.name == 'c') {
        process.exit();
      }
    });
  }

  if (opts.command) {
    var commands = opts.command.split(",");
    commands.forEach(function(command) {
      if (!keyMappings[command]) {
        fatalError('invalid --command: ' + command);
      }
    });

    var index = 0;
    function run_commands() {
      if (index < commands.length) {
        var command = commands[index++];
        keyMappings[command]();
        p.getStatus(run_commands);
      } else {
        if (opts.exit) {
          process.exit();
        }
      }
    }

    p.getStatus(run_commands);
  }
};

var capitalize = function(str) {
  return str.substr(0, 1).toUpperCase() + str.substr(1);
};

var logState = (function() {
  var inter;
  var dots = circulate(['.', '..', '...', '....']);
  return function(status) {
    if (inter) clearInterval(inter);
    debug('player status: %s', status);
    inter = setInterval(function() {
      ui.setLabel('state', 'State', capitalize(status) + dots());
      ui.render();
    }, 300);
  };
})();

player.use(function(ctx, next) {
  ctx.on('status', logState);
  next();
});

player.use(stdin);
player.use(directories);
player.use(torrent);
player.use(xspf);
player.use(localfile);
player.use(transcode);
player.use(subtitles);

player.use( function( ctx, next ) {
  if( ctx.mode !== 'launch' ) return next();
  if( ctx.options.type ) {
    // If a --type has been provided, then force it.
    ctx.options.playlist.map( function( media ) {
       media.type = ctx.options.type;
       media.contentType = ctx.options.type;
     } );
  }
  else {
    ctx.options.playlist.map( function( media ){
      if( !media.type ) {
        // These will be URLs (the MIME type for medias is filled in by the localfile plugin).
        var mimeType = mime.lookup( media.contentUrl );
        var type = mimeType.split('/')[0];
        if( type === 'audio' || type === 'video' ) {
          media.type = mimeType;
          media.contentType = mimeType;
        }
      }
    });
  }
  next()
});

player.use( async function( ctx, next ) {
  if( ctx.mode !== 'launch' ) return next();
  if( ctx.options.shuffle ) {
    ctx.options.playlist = shuffle( ctx.options.playlist );
  }

  var media = ctx.options.playlist.shift();
  ctx.options.media = media;

  if( ctx.options.loop )
    ctx.options.playlist.push( media );
  else
    ctx.options.playlist_history = [ media ];

  if( opts.metadata && media.contentType.startsWith( "audio" ) ){
    await getMetadata( media )
    .then( () => {
      if( media.audioMetadata ) {
        ctx.options.media = _.pick( media, "contentId", "contentUrl", "contentType", "metadata" );
        if( opts.showmetadata ) {
          console.log( media.audioMetadata );
        }
        if( opts.showcover ) {
          pictureToConsole( getPicture( media ) );
        }
      }
      next();
    } )
    .catch( ( err ) => {
        console.log( chalk.redBright( "Error: " + err.message + ". " ) + media.contentUrl );
        next();
    } );
  }
  next();
});

player.use( function( ctx, next ) {
  if( ctx.mode === 'launch' && opts.metadata ) {
    ctx.options.playlist.forEach( media => {
      if( !media.audioMetadata && media.contentType.startsWith( "audio" ) ) {
        getMetadata( media );
      }
    } );
  }
  next();
} );

if( opts.showoptions ) {
  console.log( opts );
}

if (!opts.playlist) {
  debug('attaching...');
  player.attach(opts, ctrl);
} else {
  debug('launching...');
  player.launch(opts, ctrl);
}

process.on('SIGINT', function() {
  process.exit();
});

process.on('exit', function() {
  ui.hide();
});

module.exports = player;
