using System.Runtime.InteropServices;

namespace DockHelper;

/// Asks the Windows shell to run a verb on a file, the way Explorer does from its right-click menu.
internal static class ShellVerbs
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct SHELLEXECUTEINFO
    {
        public int cbSize;
        public uint fMask;
        public IntPtr hwnd;
        public string lpVerb;
        public string lpFile;
        public string? lpParameters;
        public string? lpDirectory;
        public int nShow;
        public IntPtr hInstApp;
        public IntPtr lpIDList;
        public string? lpClass;
        public IntPtr hkeyClass;
        public uint dwHotKey;
        public IntPtr hIcon;
        public IntPtr hProcess;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool ShellExecuteEx(ref SHELLEXECUTEINFO info);

    const uint SEE_MASK_INVOKEIDLIST = 0x0000000C;
    const uint SEE_MASK_FLAG_NO_UI = 0x00000400;
    const int SW_SHOW = 5;

    /// The "Properties" window of a file or folder. The path must exist.
    public static bool Properties(string path)
    {
        if (!File.Exists(path) && !Directory.Exists(path)) return false;
        var info = new SHELLEXECUTEINFO { fMask = SEE_MASK_INVOKEIDLIST, lpVerb = "properties", lpFile = path, nShow = SW_SHOW };
        info.cbSize = Marshal.SizeOf(info);
        return ShellExecuteEx(ref info);
    }
}
