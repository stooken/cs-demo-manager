using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Text.Json;
using BotControllerApi;

namespace PlaybookRecorder;

public sealed record Throw(int Tick, string Weapon, float[] Position, List<float[]> Flight);
public sealed record Take(string Format, int Version, string Name, string Map, string Side, int Tickrate,
    float[][] Frames, Throw[] Throws, string[] Inventory, byte[] Motion);

internal static class TakeFile
{
    internal const int MaxTicks = 64 * 120;
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Version 1 stores the packed BotController 0.9 command ABI. The radar reads only the portable fields.
    internal static byte[] Pack(ReplayTick[] ticks, SubtickMove[] moves, ReplayCommandFrame[] commands, byte[] history)
    {
        using var output = new MemoryStream();
        using (var compressed = new BrotliStream(output, CompressionLevel.Fastest, true))
        using (var writer = new BinaryWriter(compressed))
        {
            Write(writer, ticks);
            Write(writer, moves);
            Write(writer, commands);
            Write(writer, history);
        }
        return output.ToArray();
    }

    private static void Write<T>(BinaryWriter writer, T[] values) where T : unmanaged
    {
        writer.Write(values.Length);
        writer.Write(MemoryMarshal.AsBytes(values.AsSpan()));
    }

    private static T[] Read<T>(BinaryReader reader, int max) where T : unmanaged
    {
        int count = reader.ReadInt32();
        if (count < 0 || count > max) throw new InvalidDataException("Invalid motion length.");
        var result = new T[count];
        reader.BaseStream.ReadExactly(MemoryMarshal.AsBytes(result.AsSpan()));
        return result;
    }

    internal static bool LoadMotion(IBotControllerApi api, int slot, Take take)
    {
        using var input = new MemoryStream(take.Motion);
        using var stream = new BrotliStream(input, CompressionMode.Decompress);
        using var reader = new BinaryReader(stream);
        var ticks = Read<ReplayTick>(reader, MaxTicks + 1);
        var moves = Read<SubtickMove>(reader, ticks.Length * 64);
        var commands = Read<ReplayCommandFrame>(reader, ticks.Length);
        var history = Read<byte>(reader, 16 * 1024 * 1024);
        return ticks.Length == take.Frames.Length && commands.Length == ticks.Length &&
            stream.ReadByte() == -1 && api.LoadReplay(slot, ticks, moves, commands, history);
    }

    internal static void Save(string path, Take take)
    {
        string temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var file = File.Create(temp)) JsonSerializer.Serialize(file, take, Json);
            File.Move(temp, path);
        }
        finally { File.Delete(temp); }
    }

    internal static Take Load(string path, string map)
    {
        using var file = File.OpenRead(path);
        if (file.Length > 32 * 1024 * 1024) throw new InvalidDataException("Take exceeds 32 MiB.");
        var take = JsonSerializer.Deserialize<Take>(file, Json);
        if (take is not { Format: "csdm-practice-take", Version: 1, Tickrate: 64, Side: "T" or "CT",
            Frames.Length: > 0 and <= MaxTicks + 1, Inventory.Length: <= 64, Motion.Length: > 0 } ||
            take.Map != map || take.Throws is null || take.Throws.Length > 256 ||
            take.Throws.Any(e => e?.Weapon is not ("smokegrenade" or "flashbang" or "hegrenade" or "molotov" or "incgrenade" or "decoy")) || take.Inventory.Any(name => name is null || !System.Text.RegularExpressions.Regex.IsMatch(name, "^weapon_[a-z0-9_]{1,48}$")))
            throw new InvalidDataException("Use a valid single-player take recorded on this map.");
        return take;
    }
}
