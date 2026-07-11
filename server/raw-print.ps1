param(
    [string]$texto
)

$printerName = "ELGIN i9(COM3)"


Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFO
    {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }


    [DllImport("winspool.Drv",
        SetLastError=true,
        CharSet=CharSet.Auto)]
    public static extern bool OpenPrinter(
        string pPrinterName,
        out IntPtr phPrinter,
        IntPtr pDefault);


    [DllImport("winspool.Drv",
        SetLastError=true)]
    public static extern bool ClosePrinter(
        IntPtr hPrinter);


    [DllImport("winspool.Drv",
        SetLastError=true)]
    public static extern int StartDocPrinter(
        IntPtr hPrinter,
        int level,
        ref DOCINFO di);


    [DllImport("winspool.Drv",
        SetLastError=true)]
    public static extern bool EndDocPrinter(
        IntPtr hPrinter);


    [DllImport("winspool.Drv",
        SetLastError=true)]
    public static extern bool StartPagePrinter(
        IntPtr hPrinter);


    [DllImport("winspool.Drv",
        SetLastError=true)]
    public static extern bool EndPagePrinter(
        IntPtr hPrinter);


    [DllImport("winspool.Drv",
        SetLastError=true)]
    public static extern bool WritePrinter(
        IntPtr hPrinter,
        byte[] data,
        int count,
        out int written);
}
"@


$data = New-Object System.Collections.Generic.List[byte]


if(!$texto){

    $texto = "SEM TEXTO RECEBIDO"

}


foreach($b in [System.Text.Encoding]::GetEncoding(850).GetBytes($texto)){

    $data.Add($b)

}


$data.Add(29)
$data.Add(86)
$data.Add(1)



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
    $data.ToArray(),
    $data.Count,
    [ref]$written))
{
    throw "Falha WritePrinter"
}


[RawPrinter]::EndPagePrinter($printer) | Out-Null
[RawPrinter]::EndDocPrinter($printer) | Out-Null
[RawPrinter]::ClosePrinter($printer) | Out-Null


Write-Host "Impresso. Bytes enviados:" $written