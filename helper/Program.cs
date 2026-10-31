using System.Collections.Concurrent;
using System.Text.Json.Nodes;

namespace DockHelper;

internal static class Program
{
    static readonly object OutLock = new();
    static readonly BlockingCollection<JsonObject> Queue = new();
    static Native.WinEventProc? hookProc; // kept alive for the GC
    static System.Threading.Timer? debounce, safetyNet;
    static string lastWindowsJson = "";
    static long lastTrash = -1;
    static uint ignorePid;

    static void Send(JsonObject obj)
    {
        lock (OutLock) { Console.Out.WriteLine(obj.ToJsonString()); Console.Out.Flush(); }
    }

    static void Emit(string name, JsonNode? data) => Send(new JsonObject { ["event"] = name, ["data"] = data });

    static JsonObject Snapshot()
    {
        var arr = new JsonArray();
        foreach (var w in Windows.List())
            arr.Add(new JsonObject { ["hwnd"] = w.hwnd, ["pid"] = w.pid, ["exePath"] = w.exePath, ["title"] = w.title, ["minimized"] = w.minimized });
        return new JsonObject { ["windows"] = arr, ["fullscreen"] = Windows.ForegroundIsFullscreen(ignorePid), ["foreground"] = Native.GetForegroundWindow().ToInt64() };
    }

    static void PushSnapshot()
    {
        var snap = Snapshot();
        string json = snap.ToJsonString();
        if (json == lastWindowsJson) return;
        lastWindowsJson = json;
        Emit("windows", snap);
    }

    static void Refresh()
    {
        try { PushSnapshot(); PushTrash(); }
        catch (Exception e) { Console.Error.WriteLine(e); }
    }

    static void PushTrash()
    {
        var info = new Native.SHQUERYRBINFO { cbSize = System.Runtime.InteropServices.Marshal.SizeOf<Native.SHQUERYRBINFO>() };
        if (Native.SHQueryRecycleBin(null, ref info) != 0 || info.i64NumItems == lastTrash) return;
        lastTrash = info.i64NumItems;
        Emit("trash", new JsonObject { ["items"] = info.i64NumItems });
    }

    static JsonNode? Handle(string method, JsonObject p)
    {
        switch (method)
        {
            case "ping": return "pong";
            case "setIgnorePid":
                ignorePid = (uint)(p["pid"]?.GetValue<long>() ?? 0);
                Windows.OwnPid = ignorePid;
                return true;
            case "windows": return Snapshot();
            case "roundCorners":
            {
                int round = 2; // DWMWCP_ROUND
                return Native.DwmSetWindowAttribute(new IntPtr(p["hwnd"]!.GetValue<long>()), 33, ref round, sizeof(int)) == 0;
            }
            case "activate": Windows.Activate(p["hwnd"]!.GetValue<long>()); return true;
            case "minimize": Windows.Minimize(p["hwnd"]!.GetValue<long>()); return true;
            case "close": Windows.Close(p["hwnd"]!.GetValue<long>()); return true;
            case "properties": return ShellVerbs.Properties(p["path"]!.GetValue<string>());
            case "desktopAttach": return Desktop.Attach(p["hwnd"]!.GetValue<long>(), p["x"]!.GetValue<int>(), p["y"]!.GetValue<int>(), p["width"]!.GetValue<int>(), p["height"]!.GetValue<int>());
            case "desktopDetach": return Desktop.Detach(p["hwnd"]!.GetValue<long>());
            case "toBottom": Windows.ToBottom(p["hwnd"]!.GetValue<long>()); return true;
            case "lock": return Native.LockWorkStation();
            case "sleep": return Native.SetSuspendState(false, false, false);
            case "startMenu": Windows.StartMenu(); return true;
            case "mediaKey": Windows.MediaKey(p["key"]!.GetValue<string>()); return true;
            case "icon": return Icons.PngBase64(p["path"]!.GetValue<string>(), p["size"]?.GetValue<int>() ?? 128);
            case "resolveLink":
            {
                var l = Icons.ResolveLink(p["path"]!.GetValue<string>());
                return l == null ? null : new JsonObject { ["target"] = l.target, ["args"] = l.args, ["icon"] = l.icon, ["workDir"] = l.workDir };
            }
            case "trash":
            {
                var info = new Native.SHQUERYRBINFO { cbSize = System.Runtime.InteropServices.Marshal.SizeOf<Native.SHQUERYRBINFO>() };
                Native.SHQueryRecycleBin(null, ref info);
                return new JsonObject { ["items"] = info.i64NumItems, ["bytes"] = info.i64Size };
            }
            case "emptyTrash": return Native.SHEmptyRecycleBin(IntPtr.Zero, null, 0x1 | 0x4) == 0; // SHERB_NOCONFIRMATION | SHERB_NOSOUND: the dock asks itself and plays its own sound
            case "shutdown": System.Windows.Forms.Application.Exit(); return true;
            default: throw new InvalidOperationException("unknown method " + method);
        }
    }

    static void Worker()
    {
        foreach (var req in Queue.GetConsumingEnumerable())
        {
            var id = req["id"]?.DeepClone();
            try
            {
                var result = Handle(req["method"]!.GetValue<string>(), req["params"] as JsonObject ?? new JsonObject());
                Send(new JsonObject { ["id"] = id, ["result"] = result });
            }
            catch (Exception ex) { Send(new JsonObject { ["id"] = id, ["error"] = ex.Message }); }
        }
    }

    static void Reader()
    {
        string? line;
        while ((line = Console.In.ReadLine()) != null)
        {
            try { if (JsonNode.Parse(line) is JsonObject o) Queue.Add(o); } catch { /* ignore malformed input */ }
        }
        System.Windows.Forms.Application.Exit(); // parent closed our stdin: quit with it
    }

    [STAThread]
    static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--elevated") Environment.Exit(Elevated.Run(args));
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        var worker = new Thread(Worker) { IsBackground = true, Name = "worker" };
        worker.SetApartmentState(ApartmentState.STA);
        worker.Start();
        new Thread(Reader) { IsBackground = true, Name = "reader" }.Start();

        // Window events re-enumerate after a short quiet period; a slow timer is the safety net (hooks can miss
        // virtual desktop switches, and the recycle bin has no event). Plain threading timers: the hooks are the
        // only thing that needs this thread's message loop.
        debounce = new System.Threading.Timer(_ => Refresh(), null, Timeout.Infinite, Timeout.Infinite);
        hookProc = (_, _, _, idObject, _, _, _) =>
        {
            if (idObject != 0) return; // window-level events only
            debounce.Change(120, Timeout.Infinite);
        };
        Native.SetWinEventHook(Native.EVENT_SYSTEM_FOREGROUND, Native.EVENT_SYSTEM_MINIMIZEEND, IntPtr.Zero, hookProc, 0, 0, Native.WINEVENT_OUTOFCONTEXT);
        Native.SetWinEventHook(Native.EVENT_OBJECT_CREATE, Native.EVENT_OBJECT_NAMECHANGE, IntPtr.Zero, hookProc, 0, 0, Native.WINEVENT_OUTOFCONTEXT);
        safetyNet = new System.Threading.Timer(_ => Refresh(), null, 150, 3000);
        Emit("ready", new JsonObject { ["version"] = 1 });
        System.Windows.Forms.Application.Run();
        Queue.CompleteAdding();
    }
}
