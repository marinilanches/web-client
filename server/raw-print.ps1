param(
[string]$arquivoRaw
)

Add-Content "$PSScriptRoot\raw-debug.log" "Executado $(Get-Date) arquivo=$arquivoRaw"

$printerName="ELGIN i9(COM3)"

if(!(Test-Path $arquivoRaw)){
    throw "Arquivo RAW não encontrado: $arquivoRaw"
}

$data = [System.IO.File]::ReadAllBytes($arquivoRaw)

$printer = Get-Printer -Name $printerName

$port = $printer.PortName.Replace(":","")

$serial = New-Object System.IO.Ports.SerialPort(
    $port,
    9600,
    "None",
    8,
    "One"
)

try {

    $serial.Open()

    $serial.Write(
        $data,
        0,
        $data.Length
    )

    $serial.Close()

    Write-Host "RAW enviado:"
    Write-Host $data.Length "bytes"

}
catch {

    if($serial.IsOpen){
        $serial.Close()
    }

    throw $_
}