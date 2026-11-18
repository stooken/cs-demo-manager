using System.Text.RegularExpressions;
using BotControllerApi;
using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Core.Capabilities;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Cvars;
using CounterStrikeSharp.API.Modules.Utils;

namespace PlaybookRecorder;

public sealed class Recorder : BasePlugin
{
    public override string ModuleName => "Playbook Recorder";
    public override string ModuleVersion => "0.1.0";
    private readonly PluginCapability<IBotControllerApi> capability = new("botcontroller:api");
    private IBotControllerApi Api => capability.Get() ?? throw new InvalidOperationException("BotController is unavailable.");
    private string DirectoryPath => OperatingSystem.IsWindows()
        ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CS Demo Manager", "Playbook", "Takes")
        : Path.Combine(ModuleDirectory, "takes");
    private string FileFor(string name) => Path.Combine(DirectoryPath, name + ".take.json");
    private sealed record Capture(int Slot, string Name, string Map, string Side, int Start, string[] Inventory, List<Throw> Throws);
    private sealed record Flight(Throw Event, uint Handle);
    private readonly List<Flight> flights = [];
    private Capture? capture;
    private int? botSlot;
    private int generation;
    private bool preparing;
    private Task? writing;
    private string? last;
    private static bool ValidName(string name) => Regex.IsMatch(name, @"\A[A-Za-z0-9_-]{1,64}\z") &&
        !Regex.IsMatch(name, @"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$", RegexOptions.IgnoreCase);
    private static void Report(string message)
    {
        Server.PrintToChatAll("[Playbook] " + message);
        Server.PrintToConsole("[Playbook] " + message);
    }

    public override void Load(bool hotReload)
    {
        Directory.CreateDirectory(DirectoryPath);
        foreach (string action in new[] { "record", "stoprecord", "play", "stopplay", "currentrecs" })
            AddCommand("css_pb_" + action, "Playbook practice " + action, (p, c) => Command(p, action, c.ArgString));
        AddCommandListener("say", Chat);
        AddCommandListener("say_team", Chat);
        RegisterEventHandler<EventGrenadeThrown>((e, _) =>
        {
            if (capture is { } c && e.Userid?.Slot == c.Slot && e.Userid.PlayerPawn.Value?.AbsOrigin is { } pos)
            {
                var shot = new Throw(Math.Max(0, Api.RecordedTickCount(c.Slot) - 1), e.Weapon, [pos.X, pos.Y, pos.Z], []);
                c.Throws.Add(shot);
                string entity = (e.Weapon == "incgrenade" ? "molotov" : e.Weapon) + "_projectile";
                var projectile = Utilities.FindAllEntitiesByDesignerName<CBaseCSGrenadeProjectile>(entity)
                    .Where(p => p.Thrower.Value?.Index == e.Userid.PlayerPawn.Value?.Index)
                    .OrderByDescending(p => p.CreateTime).FirstOrDefault();
                if (projectile != null) flights.Add(new(shot, projectile.EntityHandle.Raw));
            }
            return HookResult.Continue;
        });
        RegisterEventHandler<EventPlayerDeath>((e, _) =>
        {
            if (capture is { } c && c.Slot == e.Userid?.Slot) Finish();
            return HookResult.Continue;
        });
        RegisterListener<Listeners.OnTick>(() =>
        {
            if (capture is not { } c) return;
            if (Server.TickCount - c.Start >= TakeFile.MaxTicks) { Finish(); return; }
            if (flights.Count == 0 || Server.TickCount % 2 != 0) return;
            int tick = Math.Max(0, Api.RecordedTickCount(c.Slot) - 1);
            for (int i = flights.Count - 1; i >= 0; i--)
            {
                var tracked = flights[i];
                var projectile = new CHandle<CBaseCSGrenadeProjectile>(tracked.Handle).Value;
                if (projectile?.AbsOrigin is not { } pos || tick - tracked.Event.Tick > 640)
                {
                    flights.RemoveAt(i);
                    continue;
                }
                var points = tracked.Event.Flight;
                if (points.Count == 0 || points[^1][0] < tick && (points[^1][1] != pos.X || points[^1][2] != pos.Y || points[^1][3] != pos.Z))
                    points.Add([tick, pos.X, pos.Y, pos.Z]);
            }
        });
        RegisterListener<Listeners.OnClientDisconnect>(slot =>
        {
            if (capture?.Slot == slot || botSlot == slot) Reset();
        });
        RegisterListener<Listeners.OnMapEnd>(Reset);
    }

    private HookResult Chat(CCSPlayerController? player, CommandInfo cmd)
    {
        string[] parts = cmd.ArgString.Trim().Trim('"').Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0 || parts[0] is not (".record" or ".stoprecord" or ".play" or ".stopplay" or ".currentrecs"))
            return HookResult.Continue;
        Command(player, parts[0][1..], parts.Length == 2 ? parts[1] : "");
        return HookResult.Handled;
    }

    private void Command(CCSPlayerController? player, string action, string args)
    {
        if (player is null || player.IsBot || ConVar<bool>.Find("sv_lan")?.Value != true ||
            Utilities.GetPlayers().Count(p => !p.IsBot && !p.IsHLTV) != 1)
        {
            Server.PrintToConsole("[Playbook] Use a private LAN practice session with one human player.");
            return;
        }
        try
        {
            string name = args.Trim().Trim('"');
            switch (action)
            {
                case "record": Start(player, name); break;
                case "stoprecord":
                    if (capture == null) Report("No recording in progress."); else Finish();
                    break;
                case "play": Play(name); break;
                case "stopplay": StopBot(); Report("Playback stopped."); break;
                case "currentrecs":
                    var names = Directory.EnumerateFiles(DirectoryPath, "*.take.json")
                        .Select(path => Path.GetFileName(path)[..^10]).Order(StringComparer.OrdinalIgnoreCase);
                    Report("Saved takes (console): " + DirectoryPath);
                    foreach (var item in names) Server.PrintToConsole("[Playbook] " + item);
                    break;
            }
        }
        catch (Exception ex) { Report(ex.Message); }
    }

    private void Start(CCSPlayerController player, string name)
    {
        if (capture != null || preparing || botSlot is int slot && Api.IsReplaying(slot))
            throw new InvalidOperationException("Finish the current recording or playback first.");
        if (writing is { IsCompleted: false }) throw new InvalidOperationException("The last take is still saving.");
        botSlot = null;
        if (!player.PawnIsAlive || player.PlayerPawn.Value is not { } pawn)
            throw new InvalidOperationException("Join a team and spawn before recording.");
        if (name.Length == 0) name = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        if (!ValidName(name)) throw new ArgumentException("Use a take name with 1–64 letters, digits, underscores or hyphens.");
        if (File.Exists(FileFor(name))) throw new IOException("That name already exists. Choose another name.");
        var inventory = pawn.WeaponServices?.MyWeapons.Select(w => w.Value?.DesignerName)
            .OfType<string>().Where(w => w.StartsWith("weapon_")).Distinct().ToArray() ?? [];
        if (!Api.SetReplayPawn(player.Slot, pawn.Handle) || !Api.StartRecord(player.Slot))
            throw new InvalidOperationException("BotController could not start recording.");
        capture = new(player.Slot, name, Server.MapName, player.Team == CsTeam.Terrorist ? "T" : "CT",
            Server.TickCount, inventory, []);
        Report("Recording " + name + ". Use .stoprecord to save.");
    }

    private void Finish()
    {
        if (capture is not { } c) return;
        capture = null;
        flights.Clear();
        try
        {
            Api.StopRecord(c.Slot);
            var (ticks, moves, commands) = Api.GetRecordedMotionExtended(c.Slot);
            var history = Api.GetRecordedInputHistory(c.Slot);
            if (ticks.Length == 0 || ticks.Length > TakeFile.MaxTicks + 1 || ticks.Length != commands.Length)
                throw new InvalidDataException("Incomplete or empty recording.");
            int epoch = generation;
            var path = FileFor(c.Name);
            writing = Task.Run(() =>
            {
                try
                {
                    var frames = ticks.Select(t => new[] { t.Post.OriginX, t.Post.OriginY, t.Post.OriginZ, t.Post.Pitch, t.Post.Yaw }).ToArray();
                    var events = c.Throws.Select(e => e with
                    {
                        Tick = Math.Min(e.Tick, ticks.Length - 1),
                        Flight = e.Flight.Where(point => point[0] < ticks.Length).ToList()
                    }).ToArray();
                    var take = new Take("csdm-practice-take", 1, c.Name, c.Map, c.Side, 64, frames, events, c.Inventory,
                        TakeFile.Pack(ticks, moves, commands, history));
                    TakeFile.Save(path, take);
                    Server.NextFrame(() =>
                    {
                        if (epoch != generation) return;
                        last = c.Name;
                        Report($"Saved {c.Name}: {ticks.Length} ticks, {events.Length} throws. Use .play to replay.");
                    });
                }
                catch (Exception ex) { Server.NextFrame(() => { if (epoch == generation) Report("Save failed: " + ex.Message); }); }
            });
        }
        catch (Exception ex) { Report("Recording failed: " + ex.Message); }
    }

    private void Play(string name)
    {
        if (capture != null || preparing || writing is { IsCompleted: false })
            throw new InvalidOperationException("Finish recording or wait for the current take to load.");
        if (name.Length == 0)
        {
            string? newest = last ?? Directory.EnumerateFiles(DirectoryPath, "*.take.json")
                .OrderByDescending(File.GetLastWriteTimeUtc).Select(path => Path.GetFileName(path)[..^10]).FirstOrDefault();
            name = newest ?? throw new ArgumentException("Record a take first, or use .currentrecs to list saved takes.");
        }
        if (!ValidName(name)) throw new ArgumentException("Invalid take name.");
        var path = FileFor(name);
        var map = Server.MapName;
        StopBot();
        int epoch = generation;
        preparing = true;
        _ = Task.Run(() =>
        {
            try
            {
                var take = TakeFile.Load(path, map);
                Server.NextFrame(() =>
                {
                    if (epoch != generation) return;
                    var team = take.Side == "T" ? CsTeam.Terrorist : CsTeam.CounterTerrorist;
                    if (!Utilities.GetPlayers().Any(p => p.IsBot && !p.IsHLTV && p.Team == team && p.PawnIsAlive))
                        Server.ExecuteCommand(take.Side == "T" ? "bot_add_t" : "bot_add_ct");
                    Prepare(take, team, epoch, Server.TickCount + 320);
                });
            }
            catch (Exception ex)
            {
                Server.NextFrame(() => { if (epoch == generation) { preparing = false; Report("Load failed: " + ex.Message); } });
            }
        });
    }

    private void Prepare(Take take, CsTeam team, int epoch, int deadline)
    {
        if (epoch != generation) return;
        try
        {
            var bot = Utilities.GetPlayers().FirstOrDefault(p => p.IsBot && !p.IsHLTV && p.Team == team && p.PawnIsAlive);
            if (bot?.PlayerPawn.Value is not { } pawn)
            {
                if (Server.TickCount >= deadline) throw new InvalidOperationException("Spawn a living bot on the recorded side, then retry .play.");
                Server.NextFrame(() => Prepare(take, team, epoch, deadline));
                return;
            }
            botSlot = bot.Slot;
            bot.RemoveWeapons();
            foreach (var item in take.Inventory.Concat(take.Throws.Select(e => "weapon_" + e.Weapon))
                .Where(w => w != "weapon_c4" && Regex.IsMatch(w, "^weapon_[a-z0-9_]{1,48}$")).Distinct()) bot.GiveNamedItem(item);
            if (take.Throws.Count(e => e.Weapon == "flashbang") > 1) bot.GiveNamedItem("weapon_flashbang");
            if (!Api.SetReplayPawn(bot.Slot, pawn.Handle) || !TakeFile.LoadMotion(Api, bot.Slot, take) || !Api.StartReplay(bot.Slot))
                throw new InvalidOperationException("BotController could not start this take.");
            last = take.Name;
            Report($"Playing {take.Name} on {bot.PlayerName}.");
        }
        catch (Exception ex) { Report("Playback failed: " + ex.Message); }
        preparing = false;
    }

    private void StopBot()
    {
        generation++;
        if (botSlot is int slot) Api.StopReplay(slot);
        botSlot = null;
        preparing = false;
    }

    private void Reset()
    {
        StopBot();
        if (capture is { } c) Api.StopRecord(c.Slot);
        capture = null;
        flights.Clear();
        last = null;
    }

    public override void Unload(bool hotReload)
    {
        Reset();
        writing?.GetAwaiter().GetResult();
    }
}
