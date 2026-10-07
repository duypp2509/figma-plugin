# Puts saved "layers" captures on the Windows clipboard as HTML and, when asked, presses Ctrl+V in the
# Figma window. Run by capture/layers.ts with Windows PowerShell (powershell.exe): only its
# Set-Clipboard has -AsHtml, which writes the CF_HTML format Figma reads.
#
# Stays running for the whole series of pastes: starting PowerShell and compiling the window helpers
# costs over a second, which used to be paid for every screen. Prints READY, then for each line read
# from the input one line in answer:
#   "COPY|<file>"  puts the file on the clipboard    -> COPIED
#   "PRESS"        presses Ctrl+V in the Figma window -> SENT, NO_WINDOW (the app is not running) or
#                  NOT_FOREGROUND (its window could not be brought to the front)
# or "ERROR <why>". The keystroke is sent only once the target window really is in front, so it can
# never land in another application.
param(
  [string]$ProcessName = "Figma"
)
$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FfcWindow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from, uint to, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
}
"@
Add-Type -AssemblyName System.Windows.Forms

function Send-Paste {
  $target = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
  if (-not $target) { return "NO_WINDOW" }
  $window = $target.MainWindowHandle

  if ([FfcWindow]::GetForegroundWindow() -ne $window) {
    if ([FfcWindow]::IsIconic($window)) { [FfcWindow]::ShowWindow($window, 9) | Out-Null }  # 9 = restore
    for ($attempt = 0; $attempt -lt 5 -and [FfcWindow]::GetForegroundWindow() -ne $window; $attempt++) {
      # Windows only lets the thread that owns the foreground window hand it over, so borrow its input queue.
      $ignored = 0
      $front = [FfcWindow]::GetWindowThreadProcessId([FfcWindow]::GetForegroundWindow(), [ref]$ignored)
      $self = [FfcWindow]::GetCurrentThreadId()
      [FfcWindow]::AttachThreadInput($self, $front, $true) | Out-Null
      [FfcWindow]::SetForegroundWindow($window) | Out-Null
      [FfcWindow]::AttachThreadInput($self, $front, $false) | Out-Null
      Start-Sleep -Milliseconds 150
    }
    if ([FfcWindow]::GetForegroundWindow() -ne $window) { return "NOT_FOREGROUND" }
    # A window that has just come to the front needs a moment before it takes keys.
    Start-Sleep -Milliseconds 150
  }

  [System.Windows.Forms.SendKeys]::SendWait("^v")
  return "SENT"
}

[Console]::Out.WriteLine("READY")
while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    $verb, $file = $line -split "\|", 2
    if ($verb -eq "COPY") {
      Set-Clipboard -AsHtml -Value (Get-Content -Raw -Encoding UTF8 -LiteralPath $file)
      $outcome = "COPIED"
    } else {
      $outcome = Send-Paste
    }
  } catch {
    $outcome = "ERROR " + ($_.Exception.Message -replace "\s+", " ")
  }
  [Console]::Out.WriteLine($outcome)
}
