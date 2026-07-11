param(
[string]$texto
)


$printerName="ELGIN i9(COM3)"


$data =
[System.Text.Encoding]::GetEncoding(860)
.GetBytes($texto)


if(!$texto){

    $texto = "SEM TEXTO RECEBIDO"

}


foreach($b in [System.Text.Encoding]::GetEncoding(860).GetBytes($texto)){

    $data.Add($b)

}


$data.Add(29)
$data.Add(86)



$printer = [IntPtr]::Zero


if(-not [RawPrinter]::OpenPrinter(
    $printerName,
    [ref]$printer,
    [IntPtr]::Zero))
{
    throw "Não abriu impressora"
}


$doc = New-Object RawPrinter+DOCINFO

$doc.pDocName = "Teste ESC POS"
$doc.pDataType = "RAW"


if([RawPrinter]::StartDocPrinter(
    $printer,
    1,
    [ref]$doc) -eq 0)
{
    throw "Falha StartDocPrinter"
}


if(-not [RawPrinter]::StartPagePrinter($printer))
{
    throw "Falha StartPagePrinter"
}


$written = 0


if(-not [RawPrinter]::WritePrinter(
$printer,
$data,
$data.Length,
[ref]$written
))
{
    throw "Falha WritePrinter"
}


[RawPrinter]::EndPagePrinter($printer) | Out-Null
[RawPrinter]::EndDocPrinter($printer) | Out-Null
[RawPrinter]::ClosePrinter($printer) | Out-Null


Write-Host "Impresso. Bytes enviados:" $written