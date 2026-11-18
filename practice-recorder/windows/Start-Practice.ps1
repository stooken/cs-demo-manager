[CmdletBinding()]
param(
    [string]$GameRoot,
    [ValidatePattern('^[a-z0-9_]+$')][string]$Map = 'de_mirage',
    [switch]$SetupOnly
)
$ErrorActionPreference = 'Stop'
if (Get-Process cs2 -ErrorAction SilentlyContinue) { throw 'Close CS2 before opening practice.' }

if (!$GameRoot) {
    $steam = (Get-ItemProperty HKCU:\Software\Valve\Steam).SteamPath
    $libraries = @($steam) + @(Select-String -Path "$steam/steamapps/libraryfolders.vdf" -Pattern '"path"\s+"([^"]+)"' |
        ForEach-Object { $_.Matches[0].Groups[1].Value.Replace('\\', '\') })
    $GameRoot = $libraries | ForEach-Object { Join-Path $_ 'steamapps/common/Counter-Strike Global Offensive/game' } |
        Where-Object { Test-Path -LiteralPath "$_/bin/win64/cs2.exe" } | Select-Object -First 1
}
if (!$GameRoot -or !(Test-Path -LiteralPath "$GameRoot/csgo/gameinfo.gi")) { throw 'Supply -GameRoot with the CS2 game directory.' }
$source = (Resolve-Path -LiteralPath $GameRoot).Path
$root = Join-Path (Split-Path (Split-Path $source)) 'CS Demo Manager Practice'
$marker = Join-Path $root '.playbook-profile'
if ((Test-Path -LiteralPath $root) -and !(Test-Path -LiteralPath $marker)) { throw "A different folder already exists at $root." }
[IO.Directory]::CreateDirectory($root) | Out-Null
[IO.File]::WriteAllText($marker, 'Playbook practice profile v1')
$lock = [IO.File]::Open("$root/profile.lock", 'OpenOrCreate', 'ReadWrite', 'None')
try {
    $game = "$root/game"
    $mod = "$game/csgo"
    [IO.Directory]::CreateDirectory("$mod/addons") | Out-Null
    foreach ($relative in 'bin','core','csgo_lv','csgo_addons','csgo_community_addons','csgo/bin','csgo/import_scripts','csgo/lighting','csgo/maps','csgo/movie','csgo/panorama','csgo/resource','csgo/tools') {
        if ((Test-Path -LiteralPath "$source/$relative") -and !(Test-Path -LiteralPath "$game/$relative")) {
            New-Item -ItemType Junction -Path "$game/$relative" -Target "$source/$relative" | Out-Null
        }
    }
    $stamp = "$root/steam-build.txt"
    $build = (Get-FileHash -LiteralPath "$source/csgo/steam.inf").Hash
    if (!(Test-Path -LiteralPath $stamp) -or (Get-Content -Raw -LiteralPath $stamp) -ne $build) {
        foreach ($file in Get-ChildItem -LiteralPath "$source/csgo" -File) {
            $target = "$mod/$($file.Name)"
            if ($file.Extension -in '.vpk','.bin','.dat','.fgd') {
                # Refresh only this profile's link when Steam installs a new build.
                if (Test-Path -LiteralPath $target) { [IO.File]::Delete($target) }
                New-Item -ItemType HardLink -Path $target -Target $file.FullName | Out-Null
            } elseif ($file.Extension -in '.gi','.inf','.vdf') {
                Copy-Item -LiteralPath $file.FullName -Destination $target -Force
            }
        }
        [IO.Directory]::CreateDirectory("$mod/cfg") | Out-Null
        Get-ChildItem -LiteralPath "$source/csgo/cfg" | Copy-Item -Destination "$mod/cfg" -Recurse -Force
        $path = "$mod/gameinfo.gi"
        $original = [IO.File]::ReadAllText($path)
        $search = [regex]'(?m)(\bSearchPaths\s*\r?\n\s*\{)'
        if ($search.Matches($original).Count -ne 1) { throw 'Unrecognized CS2 SearchPaths layout.' }
        if ($original -notmatch '(?im)^\s*Game\s+csgo/addons/metamod') {
            $original = $search.Replace($original, '$1' + [Environment]::NewLine + '            Game    csgo/addons/metamod', 1)
        }
        $original = $original -replace '(?m)^[\t ]*CustomNavBuild\s*\{[^{}]*\}[\t ]*\r?\n?', ''
        [IO.File]::WriteAllText($path, $original)
        [IO.File]::WriteAllText($stamp, $build)
    }
    $packages = @(
        @('https://mms.alliedmods.net/mmsdrop/2.0/mmsource-2.0.0-git1490-windows.zip','135A34C9F9E9768D59AE707DD928511984E8F319F0EF6A7DD878C8A4445881A2'),
        @('https://github.com/roflmuffin/CounterStrikeSharp/releases/download/v1.0.380/counterstrikesharp-with-runtime-windows-1.0.380.zip','9A8881F83054A066F3F105D7F97B7C8A683104A4B5A381EA048D6B9A07C11203'),
        @('https://github.com/XBribo/CS2-Bot-Controller/releases/download/v0.9.0/BotController-MM-windows-0.9.0.zip','83636D7A4FB1EE01B2AF349C2F0AD1C08E2D2792DD01CCB80039F9EFA7E4AA06'),
        @('https://github.com/XBribo/CS2-Bot-Controller/releases/download/v0.9.0/BotController-CSS-API-0.9.0.zip','981CA7F04BAE1CAB4EA30589AEFE15336141D7816FB59BD9322AE29A588CDF52')
    )
    [IO.Directory]::CreateDirectory("$root/packages") | Out-Null
    foreach ($package in $packages) {
        $hash = $package[1]
        $installed = "$root/packages/$hash.ok"
        if (Test-Path -LiteralPath $installed) { continue }
        $zip = "$root/packages/$hash.zip"
        Write-Host ("Installing " + [IO.Path]::GetFileName($package[0]))
        Invoke-WebRequest -UseBasicParsing -Uri $package[0] -OutFile $zip
        if ((Get-FileHash -LiteralPath $zip).Hash -ne $hash) { throw "Package checksum mismatch: $zip" }
        Expand-Archive -LiteralPath $zip -DestinationPath $mod -Force
        [IO.File]::WriteAllText($installed, $hash)
    }
    $plugin = "$mod/addons/counterstrikesharp/plugins/PlaybookRecorder"
    [IO.Directory]::CreateDirectory($plugin) | Out-Null
    Copy-Item -LiteralPath "$PSScriptRoot/PlaybookRecorder.dll" -Destination "$plugin/PlaybookRecorder.dll" -Force
    $cfg = @(
        'sv_lan 1','sv_cheats 1','mp_limitteams 0','mp_autoteambalance 0','mp_ignore_round_win_conditions 1',
        'mp_freezetime 0','mp_warmup_pausetimer 0','mp_warmuptime 0','mp_respawn_on_death_t 1','mp_respawn_on_death_ct 1',
        'mp_roundtime_defuse 60','mp_buy_anywhere 1','mp_buytime 3600','mp_maxmoney 60000','mp_startmoney 60000',
        'ammo_grenade_limit_total 5','ammo_grenade_limit_flashbang 2','bot_quota 0','bot_quota_mode normal'
    )
    [IO.File]::WriteAllLines("$mod/cfg/gamemode_casual_server.cfg", [string[]]$cfg)
    if ($SetupOnly) { Write-Host "Ready: $game"; return }
    $env:SteamAppId = '730'
    $env:SteamGameId = '730'
    $argsList = "-basedir ""$game"" -game csgo -insecure -console -novid +install_dlc_workshoptools_cvar 1 +ip 127.0.0.1 +sv_lan 1 +game_type 0 +game_mode 0 +map $Map"
    $process = Start-Process -FilePath "$game/bin/win64/cs2.exe" -WorkingDirectory $game -ArgumentList $argsList -PassThru
    $process.WaitForExit()
} finally {
    $lock.Dispose()
}
