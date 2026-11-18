# Single-player practice recorder

Record one human player on a local CS2 practice server and replay the same take on a CS2 bot or the Playbook radar. The server can record up to two minutes at 64 ticks per second. Start before the movement or grenade preparation you want to capture. Let a grenade land before stopping if you want its full flight on the radar.

## Windows quick start

1. Open Steam and close CS2. In the Windows recorder kit, double-click **Playbook Practice.cmd**. The first launch downloads the pinned MetaMod, CounterStrikeSharp and BotController packages and checks their SHA-256 hashes. Mirage opens by default. To choose another map, run `"Playbook Practice.cmd" -Map de_inferno`.
2. Join T or CT, equip the utility you want, then type `.record entry` in **game chat**. Walk the route, move your crosshair and throw. Type `.stoprecord` and wait for the saved message. Each name identifies a separate take.
3. Step clear of the route and type `.play`. The recorder equips a living bot on the recorded side, adding one if needed. Use `.play entry` to select a saved take. Load the original map before replaying. Use `.stopplay` to interrupt a run.
4. In the desktop app, open **Playbook → Practice takes** and select **entry**. Use Play or drag the timeline. Click a grenade below the timeline to seek to its release. The radar follows the player’s floor and shows heading, pitch, release and the sampled flight.

`.currentrecs` lists saved takes in the game console. Omitting the name after `.record` uses the current date and time. Console equivalents are `css_pb_record`, `css_pb_stoprecord`, `css_pb_play`, `css_pb_stopplay` and `css_pb_currentrecs`.

## Files and practice profile

Windows takes live in `%LOCALAPPDATA%\CS Demo Manager\Playbook\Takes`. Each `.take.json` contains the radar data and the compressed native bot recording. To move a take to another machine, copy that file. **Open take file** opens it directly on the radar. Place it in the takes directory to select it in game using its filename without `.take.json`.

The launcher creates a sibling **CS Demo Manager Practice** folder in the Steam library that contains CS2. It shares stock assets through hard links and directory junctions. The profile has its own game configuration and addons. Running the launcher again refreshes the profile after a game update. Start Steam's normal CS2 entry or the existing KZ launcher for those sessions. The practice launcher uses `-insecure`, loopback and `sv_lan 1`.

## Build the plugin

Install the .NET 10 SDK. The project references the public managed APIs from CounterStrikeSharp 1.0.380 and BotController 0.9.0. Extract the Windows packages listed in `windows/Start-Practice.ps1` into a staging folder, then build from the repository root in PowerShell.

```powershell
$addons = (Resolve-Path 'staging/addons').Path
dotnet build practice-recorder -c Release "-p:Addons=$addons"
Copy-Item practice-recorder/bin/Release/net10.0/PlaybookRecorder.dll practice-recorder/windows/
```

The Windows kit consists of that DLL plus both launcher files. For a separately managed practice server with the matching dependencies, install the DLL in `game/csgo/addons/counterstrikesharp/plugins/PlaybookRecorder/`. The recorder accepts commands in a single-human LAN session. On Linux the plugin uses its own `takes/` folder. This release was tested on Windows.

## Implementation

MetaMod loads CounterStrikeSharp and BotController. The recorder uses BotController's public capability for native movement, view angles, weapon selection, buttons and sub-tick input. It listens to the game's grenade release event and samples the thrower's projectile for the radar. The bot replays the native input with weapons equipped, and CS2 simulates its projectiles.

Take format version 1 includes map, side, tick rate, an array of world-space `[x,y,z,pitch,yaw]` frames and tick-indexed throws. Each flight point is `[tick,x,y,z]`. The opaque motion payload uses the pinned BotController 0.9 ABI. The desktop reader validates the portable fields and leaves the motion payload with the original file. A completed take is published with an atomic file move.

Dependencies and their source and licenses are available from [MetaMod:Source](https://www.sourcemm.net/), [CounterStrikeSharp](https://github.com/roflmuffin/CounterStrikeSharp/releases/tag/v1.0.380) and [BotController](https://github.com/XBribo/CS2-Bot-Controller/releases/tag/v0.9.0).

## Live verification

On CS2 Windows build 1.41.9.8, a 542-tick Mirage take recorded movement, a view-angle change and a smoke. A separate server-side observer sampled the replay bot every fourth tick. All 135 samples matched the corresponding recorded position, pitch and yaw. The game logged identical smoke release position, initial velocity and detonation position for the player and the bot.

Additional takes exercised a crouched smoke and jumping flash, two consecutive flashes, HE, decoy, Molotov and a CT incendiary on Inferno. The test compared server-reported detonation coordinates for the player and the bot. To repeat a comparison, enable server logging with `log on`, record the take, step clear and replay it. Compare the player's and bot's `sv_throw_` and `threw` entries. On the desktop, select the same take, scrub to each release and play through the flight.
