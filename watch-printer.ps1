$ErrorActionPreference = "Stop"

$arquivo = "$env:USERPROFILE\web-client\server\printer.js"
$servico = "MesaFacilPrinter"

$diretorio = Split-Path $arquivo


$watcher = New-Object System.IO.FileSystemWatcher

$watcher.Path = $diretorio
$watcher.Filter = "printer.js"
$watcher.NotifyFilter = [System.IO.NotifyFilters]'LastWrite'


$action = {

    Start-Sleep -Seconds 2

    Restart-Service $servico

    Add-Content "$env:USERPROFILE\server\watch.log" "$(Get-Date) - printer.js alterado - serviço reiniciado"

}


Register-ObjectEvent `
    $watcher `
    Changed `
    -Action $action


$watcher.EnableRaisingEvents = $true


Write-Host "Monitorando $arquivo..."


while ($true) {

    Start-Sleep -Seconds 5

}