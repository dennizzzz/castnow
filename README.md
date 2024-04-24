# castnow

Castnow is a command-line utility that can be used to play back media files on
your Chromecast-enabled device. It supports playback of any
[Chromecast supported media files
](https://developers.google.com/cast/docs/media),
videos on the web and torrents. If no media is passed as a parameter, castnow
will re-attach to a running playback session.

This version of castnow:

- Almost fixes the glaring omission of the Chromecast not using the metadata
and cover art present in music files to display. The almost part being to only
use a tiny version of the cover art to fit in the arbitrary maximum message
size of 64k.

- Supports playlist parsing. Common basic formats (CUE/M3U/PLS) are supported
and as a bonus HTML files are parsed for content as well. CUE format INDEX
is also supported for single CD files, but only for selecting tracks.

Tested:

- 2019.09.01 Chromecast V2, 1.40.156414
- 2019.09.01 Sony STR-DN1080 / Chromecast Built-in, 1.21.76349

Bonus:

- Display cover art on the console if possible.
- For KDE users a desktop icon file is included. It starts castnow when you
drop an URL on it. There is a 254 in 255 chance you need to edit this for
it to work though.

### Interested in being a castnow maintainer?

Simon doesn't have that much time to maintain this project and also has lost
some interest (to be honest). Main reason is that he got a new TV that supports
casting directly to it using DLNA \(you may wanna checkout
[dlnacast](https://github.com/xat/dlnacast)). Feel free to contact him
\( [simon@sope.io](simon@sope.io) ) if you want to be added as a maintainer to
castnow.

### Install

`sudo npm install castnow -g`

or ... for this extended version:

- Clone/download from [github](https://github.com/dennizzzz/castnow)
- Go to the cloned/unzipped folder
- Run npm install to get all dependencies

### Usage

```

// start playback of a local video file
castnow ./myvideo.mp4

// start playback of video and mp3 files in the local directory
castnow ./mydirectory/

// playback 3 videos after each other
castnow video1.mp4 video2.mp4 video3.mp4

// start playback of an mp4 file over the web
castnow http://commondatastorage.googleapis.com/gtv-videos-bucket/ED_1280.mp4

// start playback of a video over torrent
castnow <url-to-torrent-file OR magnet>

// start playback of a video over torrent with local subtitles
castnow <url-to-torrent-file OR magnet> --subtitles </local/path/to/subtitles.srt>

// transcode some other video format to mp4 while playback (requires ffmpeg)
castnow ./myvideo.avi --tomp4

// transcode only audio while playback (in case the video shows, but there's no audio)
castnow ./myvideo.mkv --tomp4 --ffmpeg-vcodec copy

// change the increment at which the volume steps up or down. A lower number
// is helpful if your speakers are very loud, and you want more precision over
// the change in volume
castnow ./song.mp3 --volume-step "0.01"

// re-attach to a currently running playback session
castnow

```

### Options
<table>
<tr>
<td>
<code>--tomp4 </code>
</td>
<td>
Transcode a video file to mp4 during playback. This option requires ffmpeg to
be installed on your computer. The play / pause controls are currently not
supported in transcode mode.
</td>
</tr>
<tr>
<td>
<code>--device "my chromecast" </code>
</td>
<td>
If you have more than one Chromecast on your network, use this option to
specify the device on which you want to start casting. Otherwise, castnow will
just use the first device it finds in the network.
</td>
</tr>
<tr>
<td>
<code>--address 192.168.1.4 </code>
</td>
<td>
The IP address or hostname of your chromecast. This
  will skip the MDNS scan and improve the initial response time.
</td>
</tr>
<tr>
<td>
<code>--subtitles <path/URL> </code>
</td>
<td>
This can be a path or URL to a vtt or srt file that contains subtitles.
</td>
</tr>
<tr>
<td>
<code>--subtitle-scale 1.5 </code>
</td>
<td>
Scaling factor for the size of the subtitle font. Default is 1.0.
</td>
</tr>
<tr>
<td>
<code>--subtitle-color #FFFFFFFF </code>
</td>
<td>
Foreground RGBA color of the subtitle font.
</td>
</tr>
<tr>
<td>
<code>--myip 192.168.1.8 </code>
</td>
<td>
Your main IP address. (Useful if you have multiple network adapters.)
</td>
</tr>
<tr>
<td>
<code>--quiet </code>
</td>
<td>
Hide the player timeline.
</td>
</tr>
<tr>
<td>
<code>--peerflix-&lt;option&gt; &lt;argument&gt; </code>
</td>
<td>
Pass options to peerflix.
</td>
</tr>
<tr>
<td>
<code>--ffmpeg-&lt;option&gt; &lt;argument&gt; </code>
</td>
<td>
 Pass options to ffmpeg.
</td>
</tr>
<tr>
<td>
<code>--type <type> </code>
</td>
<td>
Explicity set the mime-type of the first item in the playlist
(e.g. 'video/mp4').
</td>
</tr>
<tr>
<td>
<code>--seek <hh:mm:ss> </code>
</td>
<td>
Seek to the specified time on start using the format hh:mm:ss or mm:ss.
</td>
</tr>
<tr>
<td>
<code>--bypass-srt-encoding </code>
</td>
<td>
Disable automatic UTF-8 encoding of SRT subtitles.
</td>
</tr>
<tr>
<td>
<code>--loop </code>
</td>
<td>
Play the list of files over and over in a loop, forever.
</td>
</tr>
<tr>
<td>
<code>--shuffle </code>
</td>
<td>
Play the list of files in random order.
</td>
</tr>
<tr>
<td>
<code>--recursive </code>
</td>
<td>
 List all files in directories recursively.
</td>
</tr>
<tr>
<td>
<code>--volume-step </code>
</td>
<td>
Step at which the volume changes. Helpful for speakers that are softer or
louder than normal. Value ranges from 0 to 1. Default is 0.05.
</td>
</tr>
<tr>
<td>
<code>--metadata false</code>
</td>
<td>
Do not attempt to retrieve metadata from audio media.
</td>
</tr>
<tr>
<td>
<code>--showmetadata</code>
</td>
<td>
Show metadata.
</td>
</tr>
<tr>
<td>
<code>--showcover false</code>
</td>
<td>
Do not show cover art on console.
</td>
</tr>
<tr>
<td>
<code>--showoptions</code>
</td>
<td>
Show options.
</td>
</tr>
<tr>
<td>
<code>--command &lt;key1>,&lt;key2>,... </code>
</td>
<td>
Execute key command(s) (where each <code>&lt;key&gt;</code> is one of the keys
listed under *player controls*, below).
</td>
</tr>
<tr>
<td>
<code>--exit </code>
</td>
<td>
Exit when playback begins or <code>--command &lt;key&gt;</code> completes.
</td>
</tr>
<tr>
<td>
<code>--help </code>
</td>
<td>
 Display help message.
</td>
</tr>
</table>

Optionally, options can be preset by storing them in a file named `.castnowrc`
in the current user's home directory. For example:

```
--myip=192.168.1.8
--volume-step=0.01
```

### Player Controls
| Key                  | Action                                                        |
| -------------------: | :------------------------------------------------------------ |
| <kbd>**Space**</kbd> | Toggle between play and pause                                 |
| <kbd>**m**</kbd>     | Toggle mute                                                   |
| <kbd>**t**</kbd>     | Toggle subtitles                                              |
| <kbd>**Up**</kbd>    | Volume up                                                     |
| <kbd>**Down**</kbd>  | Volume down                                                   |
| <kbd>**Left**</kbd>  | Seek backward (keep pressed / multiple press for faster seek) |
| <kbd>**Right**</kbd> | Seek forward (keep pressed / multiple press for faster seek)  |
| <kbd>**p**</kbd>     | Previous item in the playlist (only supported in launch-mode) |
| <kbd>**n**</kbd>     | Next item in the playlist (only supported in launch-mode)     |
| <kbd>**s**</kbd>     | Stop playback                                                 |
| <kbd>**q**</kbd>     | Quit                                                          |


### YouTube Support

We had to drop direct YouTube support for now since google changed the
Chromecast YouTube API. However, there is a nice workaround in combination with
the tool [youtube-dl](https://github.com/rg3/youtube-dl):

`youtube-dl -o - https://youtu.be/BaW_jenozKc | castnow --quiet -`

Thanks to [trulex](https://github.com/trulex) for pointing that out.

### Non-Interactive

Castnow can also be used in cron jobs or via window-manager bindings; for
example:

```
// Play/pause.
castnow --command space --exit

// Louder.
castnow --command up --exit
```

#### Usage via [screen](https://www.gnu.org/software/screen/) command

To avoid starting a new castnow command every time (which takes long time) you
should use background sessions.

```
// run castnow in backgound only once:
screen -d -m -S cast_session castnow /path/to/mp3/

// use the running session:
// Play/pause.
screen -S cast_session -X stuff ' '

// Mute.
screen -S cast_session -X stuff 'm'

// Subtitles.
screen -S cast_session -X stuff 't'

// Volume up.
screen -S cast_session -X stuff $'\e[A'

// Volume down.
screen -S cast_session -X stuff $'\e[B'

// Seek backward.
screen -S cast_session -X stuff $'\e[D'

// Seek forward.
screen -S cast_session -X stuff $'\e[C'

// Next item in the playlist.
screen -S cast_session -X stuff 'n'

// stop playback.
screen -S cast_session -X stuff 's'

// quit/stop session
screen -S cast_session -X stuff 'q'
// or
screen -S cast_session -X quit
```

### reporting bugs/issues

Please include the debug output in your issues. You can enable the debug
messages by setting the DEBUG environment variable before running the castnow
command like this: `DEBUG=castnow* castnow ./myvideo.mp4`. Some problems have
already been addressed in our wiki https://github.com/xat/castnow/wiki.

Please only report metadata-related issues here and general issues there.

### contributors

* [dennizzzz](https://github.com/dennizzzz)
* [tooryx](https://github.com/tooryx)
* [przemyslawpluta](https://github.com/przemyslawpluta)

## License
Copyright (c) 2015 Simon Kusterer

Licensed under the MIT license.
