' ============================================================
'  Electronic Archive — Silent Runner (no CMD window ever)
'  Launches the health-check loop completely invisibly.
'  Usage: wscript run_silent.vbs   OR   double-click
' ============================================================
Option Explicit
Dim shell, fso, scriptPath, batPath
Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

' Resolve sibling .bat in the same folder as this .vbs
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptPath & "\health_loop.bat"

If fso.FileExists(batPath) Then
    ' 0 = hidden window, False = don't wait
    shell.Run """" & batPath & """", 0, False
End If
