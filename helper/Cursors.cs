using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace DockHelper;

/// <summary>
/// Swaps the system cursors for the files of a cursor pack, for this Windows session only. Nothing is written to the
/// registry: SetSystemCursor changes the cursors in memory, and SPI_SETCURSORS reloads the user's own scheme, which is
/// also what a restart or sign-out does. So the worst a crash can leave behind is a different pointer until the next restore.
/// </summary>
internal static class Cursors
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern IntPtr LoadCursorFromFile(string file);
    [DllImport("user32.dll", SetLastError = true)] static extern bool SetSystemCursor(IntPtr cursor, uint id);
    [DllImport("user32.dll", SetLastError = true)] static extern bool SystemParametersInfo(uint action, uint param, IntPtr data, uint flags);
    [DllImport("user32.dll")] static extern bool DestroyCursor(IntPtr cursor);

    const uint SPI_SETCURSORS = 0x0057;
    // the system cursor ids a pack can replace (OCR_*); anything else in the request is ignored
    static readonly HashSet<uint> Known = new()
    {
        32512, 32513, 32514, 32515, 32516, 32631, 32642, 32643, 32644, 32645, 32646, 32648, 32649, 32650, 32651, 32671, 32672,
    };

    /// <summary>True while this process has replaced cursors and not yet restored them.</summary>
    public static bool Applied { get; private set; }

    public static JsonObject Apply(JsonArray items)
    {
        int done = 0, failed = 0;
        foreach (var node in items)
        {
            if (node is not JsonObject o) continue;
            uint id = (uint)(o["id"]?.GetValue<int>() ?? 0);
            string file = o["file"]?.GetValue<string>() ?? "";
            if (!Known.Contains(id) || !File.Exists(file)) { failed++; continue; }
            // SetSystemCursor takes the handle over, so every call needs its own freshly loaded one
            IntPtr h = LoadCursorFromFile(file);
            if (h == IntPtr.Zero) { failed++; continue; }
            if (SetSystemCursor(h, id)) { done++; Applied = true; }
            else { DestroyCursor(h); failed++; }
        }
        return new JsonObject { ["applied"] = done, ["failed"] = failed };
    }

    public static bool Restore()
    {
        Applied = false;
        return SystemParametersInfo(SPI_SETCURSORS, 0, IntPtr.Zero, 0);
    }
}
