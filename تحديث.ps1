# تحديث
# هذا السكريبت أصبح يستدعي سكريبت التحديث الآمن UPDATE.ps1
# (نسخة احتياطية تلقائية أولاً - لا يحذف قاعدة البيانات أو المستندات أبداً - المنفذ 5599)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$safe = Join-Path $PSScriptRoot "UPDATE.ps1"
if (-not (Test-Path $safe)) {
    $safe = Join-Path $env:TEMP "EA_UPDATE.ps1"
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Fraction2026/member.union/main/UPDATE.ps1" -OutFile $safe -UseBasicParsing
}
& powershell -NoProfile -ExecutionPolicy Bypass -File $safe @args
