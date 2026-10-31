namespace DockHelper;

internal record WindowInfo(long hwnd, uint pid, string exePath, string title, bool minimized);

internal static class Windows
{
    public static uint OwnPid;

    static bool Cloaked(IntPtr h) => Native.DwmGetWindowAttribute(h, 14, out int v, sizeof(int)) == 0 && v != 0;

    // Windows Store apps are hosted by ApplicationFrameHost; the real process owns a child CoreWindow.
    static uint RealPid(IntPtr h, uint pid, string? exe)
    {
        if (exe == null || !exe.EndsWith("ApplicationFrameHost.exe", StringComparison.OrdinalIgnoreCase)) return pid;
        uint found = pid;
        Native.EnumChildWindows(h, (c, _) =>
        {
            Native.GetWindowThreadProcessId(c, out uint cp);
            if (cp != pid) { found = cp; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static List<WindowInfo> List()
    {
        var list = new List<WindowInfo>();
        Native.EnumWindows((h, _) =>
        {
            if (!Native.IsWindowVisible(h) || Native.GetWindow(h, Native.GW_OWNER) != IntPtr.Zero) return true;
            long ex = Native.GetWindowLongPtr(h, Native.GWL_EXSTYLE).ToInt64();
            if ((ex & Native.WS_EX_TOOLWINDOW) != 0 && (ex & Native.WS_EX_APPWINDOW) == 0) return true;
            if ((ex & Native.WS_EX_NOACTIVATE) != 0) return true;
            if (Cloaked(h)) return true;
            string title = Native.Text(h);
            if (title.Length == 0) return true;
            Native.GetWindowThreadProcessId(h, out uint pid);
            if (pid == OwnPid) return true;
            string? exe = Native.ExePath(pid);
            pid = RealPid(h, pid, exe);
            exe = Native.ExePath(pid) ?? exe;
            if (exe == null) return true;
            list.Add(new WindowInfo(h.ToInt64(), pid, exe, title, Native.IsIconic(h)));
            return true;
        }, IntPtr.Zero);
        return list;
    }

    /// True when the foreground window covers its whole monitor (game, video, presentation).
    public static bool ForegroundIsFullscreen(uint ignorePid)
    {
        var h = Native.GetForegroundWindow();
        if (h == IntPtr.Zero) return false;
        string cls = Native.ClassOf(h);
        if (cls is "Progman" or "WorkerW" or "Shell_TrayWnd" or "Shell_SecondaryTrayWnd") return false;
        Native.GetWindowThreadProcessId(h, out uint pid);
        if (pid == ignorePid || pid == OwnPid) return false;
        if (!Native.GetWindowRect(h, out var r)) return false;
        var mon = Native.MonitorFromWindow(h, 2);
        var info = new Native.MONITORINFO { cbSize = System.Runtime.InteropServices.Marshal.SizeOf<Native.MONITORINFO>() };
        if (!Native.GetMonitorInfo(mon, ref info)) return false;
        var m = info.rcMonitor;
        return r.Left <= m.Left && r.Top <= m.Top && r.Right >= m.Right && r.Bottom >= m.Bottom;
    }

    static void ForceForegroundPrivilege()
    {
        // A synthetic ALT press lets SetForegroundWindow succeed from a background process.
        Native.keybd_event(0x12, 0, 0, UIntPtr.Zero);
        Native.keybd_event(0x12, 0, 2, UIntPtr.Zero);
    }

    public static void Activate(long hwnd)
    {
        var h = new IntPtr(hwnd);
        if (!Native.IsWindow(h)) return;
        if (Native.IsIconic(h)) Native.ShowWindow(h, Native.SW_RESTORE);
        ForceForegroundPrivilege();
        Native.SetForegroundWindow(h);
    }

    public static void Minimize(long hwnd) => Native.ShowWindow(new IntPtr(hwnd), Native.SW_MINIMIZE);
    public static void Close(long hwnd) => Native.PostMessage(new IntPtr(hwnd), Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);

    /// Puts a window under every other window without activating it (HWND_BOTTOM, NOSIZE | NOMOVE | NOACTIVATE).
    public static void ToBottom(long hwnd) => Native.SetWindowPos(new IntPtr(hwnd), new IntPtr(1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);

    /// Opens the Start menu the way the Windows key does.
    public static void StartMenu()
    {
        Native.keybd_event(0x5B, 0, 0, UIntPtr.Zero);
        Native.keybd_event(0x5B, 0, 2, UIntPtr.Zero);
    }

    public static void MediaKey(string key)
    {
        byte vk = key switch { "next" => 0xB0, "prev" => 0xB1, "stop" => 0xB2, _ => 0xB3 };
        Native.keybd_event(vk, 0, 0, UIntPtr.Zero);
        Native.keybd_event(vk, 0, 2, UIntPtr.Zero);
    }
}
