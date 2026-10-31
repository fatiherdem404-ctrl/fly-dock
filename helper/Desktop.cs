using System.Runtime.InteropServices;

namespace DockHelper;

/// Puts a window on the desktop layer, behind the icons and above the real wallpaper, the way live-wallpaper tools do.
/// Nothing in Windows is changed: when the window goes away the user's own wallpaper is simply visible again.
internal static class Desktop
{
    delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] static extern IntPtr FindWindow(string cls, string? title);
    [DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string? title);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetParent(IntPtr child, IntPtr parent);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, UIntPtr w, IntPtr l, uint flags, uint timeout, out UIntPtr result);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);

    [DllImport("user32.dll")] static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint key, byte alpha, uint flags);

    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }

    const uint SWP_NOACTIVATE = 0x0010;
    const uint SWP_SHOWWINDOW = 0x0040;
    const uint SWP_FRAMECHANGED = 0x0020;
    static readonly IntPtr HWND_BOTTOM = new(1);

    /// The window that sits between the wallpaper and the icons. Windows 10 and 11 up to 23H2 keep it as a sibling of
    /// the window hosting the icon list; 24H2 made it a child of Progman.
    static IntPtr FindWorkerW()
    {
        var progman = FindWindow("Progman", null);
        if (progman == IntPtr.Zero) return IntPtr.Zero;
        // asks the shell to create the extra desktop window (an undocumented but long-stable message)
        SendMessageTimeout(progman, 0x052C, UIntPtr.Zero, IntPtr.Zero, 0, 1000, out _);

        // 24H2 and newer: a screen-sized WorkerW inside Progman, below the icon list
        var inside = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null);
        if (IsScreenSized(inside)) return inside;

        var found = IntPtr.Zero;
        EnumWindows((top, _) =>
        {
            if (FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero)
                found = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
            return true;
        }, IntPtr.Zero);
        return IsScreenSized(found) ? found : IntPtr.Zero;
    }

    /// The shell keeps many small WorkerW windows for other purposes; only a desktop-sized one is the wallpaper layer.
    static bool IsScreenSized(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !GetWindowRect(hwnd, out var r)) return false;
        return r.Right - r.Left >= 400 && r.Bottom - r.Top >= 300;
    }

    /// Re-parents the window under the desktop layer and sizes it to the given physical-pixel rectangle on screen.
    /// On 24H2 and newer the window goes into Progman itself, directly below the icon list and above the shell's own
    /// wallpaper window; on older Windows it goes into the WorkerW that sits behind the icons.
    public static bool Attach(long hwnd, int x, int y, int width, int height)
    {
        var window = new IntPtr(hwnd);
        var worker = FindWorkerW();
        if (worker == IntPtr.Zero) { Console.Error.WriteLine("desktop: no wallpaper layer found"); return false; }
        var progman = FindWindow("Progman", null);
        var inProgman = GetAncestor(worker, 1) == progman;
        var parent = inProgman ? progman : worker;
        var after = inProgman ? FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null) : HWND_BOTTOM;
        if (after == IntPtr.Zero) after = HWND_BOTTOM;
        // a real child window: no frame, no caption, clipped to its parent (a frameless Electron window still carries them)
        // Windows 11 24H2+ draws the icons in a layered child of Progman and the wallpaper in a WorkerW below it, so a
        // window that wants to sit between them has to be a layered child too (fully opaque).
        const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
        const long WS_CHILD = 0x40000000, WS_VISIBLE = 0x10000000;
        const long WS_EX_LAYERED = 0x80000, WS_EX_APPWINDOW = 0x40000;
        var ex = GetWindowLongPtr(window, GWL_EXSTYLE).ToInt64();
        SetWindowLongPtr(window, GWL_EXSTYLE, new IntPtr((ex | WS_EX_LAYERED) & ~WS_EX_APPWINDOW));
        SetLayeredWindowAttributes(window, 0, 255, 2);
        SetWindowLongPtr(window, GWL_STYLE, new IntPtr(WS_CHILD | WS_VISIBLE));
        SetParent(window, parent);
        // GetParent would answer with the owner for a popup window; the real parent is what matters
        if (GetAncestor(window, 1) != parent) { Console.Error.WriteLine($"desktop: SetParent failed, error {Marshal.GetLastWin32Error()}"); return false; }
        GetWindowRect(parent, out var origin);
        SetWindowPos(window, after, x - origin.Left, y - origin.Top, width, height, SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
        return true;
    }

    public static bool Detach(long hwnd)
    {
        SetParent(new IntPtr(hwnd), IntPtr.Zero);
        return true;
    }
}
