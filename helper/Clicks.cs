using System.Runtime.InteropServices;
using System.Text;

namespace DockHelper;

/// <summary>
/// Watches the left mouse button so the live wallpapers can react to clicks on the desktop. The wallpaper window sits
/// behind the desktop icons and never receives a click, so the button is polled; only a press that lands on the desktop
/// itself (its icons or the empty background, not another window or the taskbar) is reported.
/// </summary>
internal static class Clicks
{
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int max);

    const int VK_LBUTTON = 0x01;
    const uint GA_ROOT = 2;
    static System.Threading.Timer? timer;
    static bool down;

    public static void Watch(bool on, Action<int, int> onClick)
    {
        if (!on)
        {
            timer?.Dispose();
            timer = null;
            return;
        }
        if (timer != null) return;
        down = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
        timer = new System.Threading.Timer(_ =>
        {
            try
            {
                bool pressed = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
                if (pressed && !down && OnDesktop(out var pt)) onClick(pt.X, pt.Y);
                down = pressed;
            }
            catch { /* a failed poll is just a missed click */ }
        }, null, 0, 16);
    }

    static bool OnDesktop(out POINT pt)
    {
        pt = default;
        if (!GetCursorPos(out pt)) return false;
        var hit = WindowFromPoint(pt);
        if (hit == IntPtr.Zero) return false;
        var root = GetAncestor(hit, GA_ROOT);
        var sb = new StringBuilder(64);
        GetClassName(root == IntPtr.Zero ? hit : root, sb, sb.Capacity);
        string cls = sb.ToString();
        return cls == "Progman" || cls == "WorkerW";
    }
}
