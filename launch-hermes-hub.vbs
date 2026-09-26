Option Explicit

Dim shell, fileSystem, scriptDirectory, pnpmDirectory, packageFolder
Dim electronPath, appPath, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
pnpmDirectory = fileSystem.BuildPath(scriptDirectory, "node_modules\.pnpm")
electronPath = ""

If fileSystem.FolderExists(pnpmDirectory) Then
  For Each packageFolder In fileSystem.GetFolder(pnpmDirectory).SubFolders
    If LCase(Left(fileSystem.GetFileName(packageFolder.Path), 9)) = "electron@" Then
      electronPath = fileSystem.BuildPath(packageFolder.Path, "node_modules\electron\dist\electron.exe")
      If fileSystem.FileExists(electronPath) Then Exit For
      electronPath = ""
    End If
  Next
End If

If electronPath = "" Then
  MsgBox "Hermes Hub dependencies are missing. Run pnpm install first.", 16, "Hermes Hub"
  WScript.Quit 1
End If

appPath = fileSystem.BuildPath(scriptDirectory, "apps\desktop")
command = Chr(34) & electronPath & Chr(34) & " " & Chr(34) & appPath & Chr(34)

shell.CurrentDirectory = appPath
shell.Run command, 1, False
