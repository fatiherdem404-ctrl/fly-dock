using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace DockHelper;

internal static class Icons
{
    static readonly Guid FactoryGuid = new("bcc18b79-ba16-442f-80c4-8a59c30c463b");

    public record LinkInfo(string target, string args, string icon, string workDir);

    public static LinkInfo? ResolveLink(string path)
    {
        try
        {
            var type = Type.GetTypeFromProgID("WScript.Shell");
            if (type == null) return null;
            dynamic shell = Activator.CreateInstance(type)!;
            dynamic link = shell.CreateShortcut(path);
            string icon = (string)link.IconLocation;
            int comma = icon.LastIndexOf(',');
            if (comma > 0) icon = icon[..comma];
            return new LinkInfo((string)link.TargetPath, (string)link.Arguments, icon, (string)link.WorkingDirectory);
        }
        catch (Exception e) { Console.Error.WriteLine(e); return null; }
    }

    /// PNG (base64) of the shell icon for any path, up to 256px, with alpha.
    public static string? PngBase64(string path, int size)
    {
        size = Math.Clamp(size, 16, 256);
        string target = path;
        if (path.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase))
        {
            var link = ResolveLink(path);
            if (link != null)
            {
                if (link.icon.Length > 0 && File.Exists(link.icon) && !link.icon.EndsWith(".ico", StringComparison.OrdinalIgnoreCase)) target = link.icon;
                else if (link.target.Length > 0 && (File.Exists(link.target) || Directory.Exists(link.target))) target = link.target;
            }
        }
        using var bmp = Fetch(target, size) ?? (target != path ? Fetch(path, size) : null);
        if (bmp == null) return null;
        using var ms = new MemoryStream();
        bmp.Save(ms, ImageFormat.Png);
        return Convert.ToBase64String(ms.ToArray());
    }

    static Bitmap? Fetch(string path, int size)
    {
        try
        {
            var iid = FactoryGuid;
            int hr0 = Native.SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out var ptr);
            if (hr0 != 0 || ptr == IntPtr.Zero) { Console.Error.WriteLine($"SHCreateItem {path} hr={hr0:X}"); return null; }
            var factory = (Native.IShellItemImageFactory)Marshal.GetObjectForIUnknown(ptr);
            Marshal.Release(ptr);
            // ICONONLY(4) | BIGGERSIZEOK(1): the icon, never a thumbnail.
            int hr = factory.GetImage(new Native.SIZE { cx = size, cy = size }, 4 | 1, out var hbmp);
            if (hr != 0 || hbmp == IntPtr.Zero) return null;
            try { return FromHBitmap(hbmp); }
            finally { Native.DeleteObject(hbmp); }
        }
        catch (Exception e) { Console.Error.WriteLine(e); return null; }
    }

    static Bitmap? FromHBitmap(IntPtr hbmp)
    {
        Native.GetObject(hbmp, Marshal.SizeOf<Native.BITMAP>(), out var info);
        if (info.bmBitsPixel != 32 || info.bmBits == IntPtr.Zero || info.bmHeight <= 0) return null;
        using var raw = new Bitmap(info.bmWidth, info.bmHeight, info.bmWidthBytes, PixelFormat.Format32bppArgb, info.bmBits);
        var copy = new Bitmap(info.bmWidth, info.bmHeight, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(copy))
        {
            g.CompositingMode = CompositingMode.SourceCopy;
            g.DrawImage(raw, 0, 0, info.bmWidth, info.bmHeight);
        }
        return copy;
    }
}
