!ifndef VERSION
  !define VERSION "0.0.0"
!endif

!ifndef APP_DIR
  !error "APP_DIR is required"
!endif

!ifndef OUT_FILE
  !define OUT_FILE "CodexBridge-Windows-x64-Setup.exe"
!endif

!ifndef ICON_PATH
  !error "ICON_PATH is required"
!endif

Unicode True
Name "CodexBridge"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\CodexBridge"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "${ICON_PATH}"
BrandingText "CodexBridge"

!include "MUI2.nsh"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetShellVarContext current
  CreateDirectory "$INSTDIR"
  SetOutPath "$INSTDIR\app-${VERSION}"
  File /r "${APP_DIR}\*.*"

  CreateDirectory "$SMPROGRAMS\CodexBridge"
  CreateShortCut "$SMPROGRAMS\CodexBridge\CodexBridge.lnk" "$INSTDIR\app-${VERSION}\CodexBridge.exe"
  CreateShortCut "$DESKTOP\CodexBridge.lnk" "$INSTDIR\app-${VERSION}\CodexBridge.exe"

  WriteRegStr HKCU "Software\CodexBridge" "CurrentVersion" "${VERSION}"
  WriteRegStr HKCU "Software\CodexBridge" "InstallLocation" "$INSTDIR\app-${VERSION}"

  ExecShell "" "$INSTDIR\app-${VERSION}\CodexBridge.exe" "--updated"
SectionEnd
