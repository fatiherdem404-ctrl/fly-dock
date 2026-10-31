using System.Diagnostics;
using Microsoft.Win32;

namespace DockHelper;

/// Short-lived administrator mode: `dock-helper.exe --elevated <apply|revert> <id>`. The app starts it through the
/// normal Windows UAC prompt, it does exactly one fixed job from the list below and exits. Anything else is refused.
/// Exit codes: 0 done, 2 unknown request, 5 not allowed (not elevated), 1 failed.
internal static class Elevated
{
    const string ShellIcons = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Icons";

    public static int Run(string[] args)
    {
        if (args.Length != 3) return 2;
        string op = args[1], id = args[2];
        if (op != "apply" && op != "revert") return 2;
        try
        {
            return id switch
            {
                "shortcut-arrow" => ShortcutArrow(op),
                "hibernate" => Powercfg(op == "apply" ? "/h off" : "/h on"),
                "restore-point" => op == "apply" ? RestorePoint() : 2,
                _ => 2,
            };
        }
        catch (UnauthorizedAccessException) { return 5; }
        catch (System.Security.SecurityException) { return 5; }
        catch { return 1; }
    }

    // value "29" is the overlay Explorer draws on shortcuts; pointing it at an empty icon hides the arrow
    static int ShortcutArrow(string op)
    {
        using var key = Registry.LocalMachine.CreateSubKey(ShellIcons, true);
        if (op == "apply") key.SetValue("29", @"%windir%\System32\shell32.dll,-50", RegistryValueKind.String);
        else key.DeleteValue("29", false);
        return 0;
    }

    static int Powercfg(string arguments) => RunTool("powercfg.exe", arguments);

    static int RestorePoint() =>
        RunTool("powershell.exe", "-NoProfile -NonInteractive -Command \"Checkpoint-Computer -Description 'Fly Dock' -RestorePointType MODIFY_SETTINGS\"");

    static int RunTool(string file, string arguments)
    {
        using var p = Process.Start(new ProcessStartInfo(file, arguments) { CreateNoWindow = true, UseShellExecute = false });
        if (p == null) return 1;
        p.WaitForExit(60_000);
        return p.ExitCode == 0 ? 0 : 1;
    }
}
