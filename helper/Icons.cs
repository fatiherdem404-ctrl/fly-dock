// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
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
        using var bmp = Fetch(target, size) ?? (target != path ? Fetch(path, size) : null) ?? FileTypeIcon(path);
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

    /// Generic icon for the file type, for items the shell cannot parse as a file (entries of the Fonts folder, deleted targets).
    static Bitmap? FileTypeIcon(string path)
    {
        try
        {
            var info = new Native.SHFILEINFO();
            // 0x100 ICON | 0x0 LARGE | 0x10 USEFILEATTRIBUTES: look the type up by extension without touching the file
            var ok = Native.SHGetFileInfo(path, 0x80, ref info, (uint)Marshal.SizeOf<Native.SHFILEINFO>(), 0x100 | 0x10);
            if (ok == IntPtr.Zero || info.hIcon == IntPtr.Zero) return null;
            try
            {
                using var icon = Icon.FromHandle(info.hIcon);
                return new Bitmap(icon.ToBitmap());
            }
            finally { Native.DestroyIcon(info.hIcon); }
        }
        catch { return null; }
    }

    /// Reads the pixels top-down through GetDIBits: the raw bits of a shell bitmap may be stored bottom-up,
    /// which would flip the icon vertically.
    static Bitmap? FromHBitmap(IntPtr hbmp)
    {
        Native.GetObject(hbmp, Marshal.SizeOf<Native.BITMAP>(), out var info);
        int w = info.bmWidth, h = info.bmHeight;
        if (w <= 0 || h <= 0) return null;
        var header = new Native.BITMAPINFOHEADER { biSize = Marshal.SizeOf<Native.BITMAPINFOHEADER>(), biWidth = w, biHeight = -h, biPlanes = 1, biBitCount = 32 };
        var pixels = new byte[w * h * 4];
        var dc = Native.GetDC(IntPtr.Zero);
        int lines = Native.GetDIBits(dc, hbmp, 0, (uint)h, pixels, ref header, 0);
        Native.ReleaseDC(IntPtr.Zero, dc);
        if (lines == 0) return null;
        bool hasAlpha = false;
        for (int i = 3; i < pixels.Length; i += 4) if (pixels[i] != 0) { hasAlpha = true; break; }
        if (!hasAlpha) for (int i = 3; i < pixels.Length; i += 4) pixels[i] = 255;
        var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        bmp.UnlockBits(data);
        return bmp;
    }
}
