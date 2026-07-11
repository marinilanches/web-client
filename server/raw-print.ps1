param(
[string]$arquivoRaw
)


Add-Type -TypeDefinition @"

using System;
using System.Runtime.InteropServices;

public class RawPrinter
{

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO
    {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }


    [DllImport("winspool.Drv", 
    EntryPoint="OpenPrinter",
    SetLastError=true,
    CharSet=CharSet.Unicode,
    ExactSpelling=false,
    CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(
        string src,
        ref IntPtr hPrinter,
        IntPtr pd
    );


    [DllImport("winspool.Drv",
    EntryPoint="ClosePrinter")]
    public static extern bool ClosePrinter(
        IntPtr hPrinter
    );


    [DllImport(
    "winspool.Drv",
    SetLastError=true,
    CharSet=CharSet.Unicode
    )]
    public static extern int StartDocPrinter(
        IntPtr hPrinter,
        int level,
        [In] DOCINFO di
    );


    [DllImport("winspool.Drv")]
    public static extern bool EndDocPrinter(
        IntPtr hPrinter
    );


    [DllImport("winspool.Drv")]
    public static extern bool StartPagePrinter(
        IntPtr hPrinter
    );


    [DllImport("winspool.Drv")]
    public static extern bool EndPagePrinter(
        IntPtr hPrinter
    );


    [DllImport("winspool.Drv")]
    public static extern bool WritePrinter(
        IntPtr hPrinter,
        byte[] data,
        int count,
        ref int written
    );

}

"@


$printerName="ELGIN i9(COM3)"


if(!(Test-Path $arquivoRaw)){
    throw "Arquivo RAW não encontrado: $arquivoRaw"
}


$data = [System.IO.File]::ReadAllBytes($arquivoRaw)


# corte automático ESC/POS

$corte = [byte[]](29,86,1)

$data = $data + $corte



$printer = [IntPtr]::Zero

if(-not [RawPrinter]::OpenPrinter(
$printerName,
[ref]$printer,
[IntPtr]::Zero))
{
throw "Não abriu impressora"
}


$doc = New-Object RawPrinter+DOCINFO

$doc.pDocName = "Mesa Facil ESC POS"
$doc.pOutputFile = $null
$doc.pDataType = "RAW"


Write-Host "Abrindo documento RAW..."
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