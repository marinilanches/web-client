param(
    [string]$arquivoRaw
)

$printerName = "ELGIN i9(COM3)"

if (!(Test-Path $arquivoRaw)) {
    throw "Arquivo RAW não encontrado: $arquivoRaw"
}


$data = [System.IO.File]::ReadAllBytes($arquivoRaw)


$printer = Get-Printer -Name $printerName


if (!$printer) {
    throw "Impressora não encontrada: $printerName"
}


$rawType = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName;

        [MarshalAs(UnmanagedType.LPStr)]
        public string pOutputFile;

        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA")]
    public static extern bool OpenPrinter(
        string szPrinter,
        out IntPtr hPrinter,
        IntPtr pd
    );

    [DllImport("winspool.Drv")]
    public static extern bool ClosePrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.Drv")]
    public static extern bool StartDocPrinter(
        IntPtr hPrinter,
        int level,
        DOCINFOA di
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
        out int written
    );

    public static bool Send(
        string printer,
        byte[] data
    )
    {
        IntPtr hPrinter;

        if(!OpenPrinter(printer, out hPrinter, IntPtr.Zero))
            return false;


        DOCINFOA di = new DOCINFOA();

        di.pDocName = "Mesa Facil";
        di.pDataType = "RAW";


        bool ok =
            StartDocPrinter(hPrinter,1,di)
            &&
            StartPagePrinter(hPrinter);


        int written;


        if(ok)
        {
            ok =
                WritePrinter(
                    hPrinter,
                    data,
                    data.Length,
                    out written
                );
        }


        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);


        return ok;
    }
}
"@


Add-Type $rawType


$result =
[RawPrinter]::Send(
    $printerName,
    $data
)


if(!$result)
{
    throw "Não foi possível abrir a impressora."
}


Write-Host "RAW enviado com sucesso!"