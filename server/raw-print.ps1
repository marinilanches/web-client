param(
    [string]$arquivoRaw,
    [switch]$DetectOnly
)

$ErrorActionPreference = "Stop"

# ============================================================
# DETECÇÃO AUTOMÁTICA DA ELGIN
# ============================================================

function Find-ElginPrinter {

    $printers = @(
        Get-Printer | Where-Object {
            $_.Name -like "*ELGIN*i9*" -or
            $_.Name -like "*ELGIN*"
        }
    )

    if ($printers.Count -eq 0) {
        throw "Nenhuma impressora Elgin foi encontrada no Windows."
    }

    # Portas COM que realmente existem neste computador.
    $activeComPorts = @(
        [System.IO.Ports.SerialPort]::GetPortNames() |
        ForEach-Object {
            $_.Trim().ToUpper()
        }
    )

    # Primeiro tenta encontrar uma Elgin ligada a uma COM
    # que realmente exista neste notebook.
    foreach ($item in $printers) {

        $port = [string]$item.PortName

        if ($port) {

            $normalizedPort = $port.Trim().TrimEnd(":").ToUpper()

            if ($activeComPorts -contains $normalizedPort) {
                return $item
            }
        }
    }

    # Se não estiver usando COM (USB001, rede, etc.),
    # prefere uma fila que não esteja marcada como Offline.
    $onlinePrinter = $printers |
        Where-Object {
            [string]$_.PrinterStatus -ne "Offline"
        } |
        Select-Object -First 1

    if ($onlinePrinter) {
        return $onlinePrinter
    }

    # Último fallback:
    # usa a primeira impressora Elgin encontrada.
    return $printers | Select-Object -First 1
}


$printer = Find-ElginPrinter

if (!$printer) {
    throw "Não foi possível localizar uma impressora ELGIN."
}

$printerName = $printer.Name
$printerPort = $printer.PortName


# ============================================================
# SOMENTE DETECTAR
# ============================================================

if ($DetectOnly) {

    Write-Output $printerName

    exit 0
}


# ============================================================
# VALIDAR ARQUIVO RAW
# ============================================================

if ([string]::IsNullOrWhiteSpace($arquivoRaw)) {
    throw "O caminho do arquivo RAW não foi informado."
}

if (!(Test-Path -LiteralPath $arquivoRaw)) {
    throw "Arquivo RAW não encontrado: $arquivoRaw"
}


$data = [System.IO.File]::ReadAllBytes($arquivoRaw)


# ============================================================
# API RAW DO WINDOWS
# ============================================================

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

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA",
        SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(
        string szPrinter,
        out IntPtr hPrinter,
        IntPtr pd
    );

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool ClosePrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartDocPrinter(
        IntPtr hPrinter,
        int level,
        DOCINFOA di
    );

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndDocPrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartPagePrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndPagePrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.Drv", SetLastError=true)]
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

        if (!OpenPrinter(
            printer,
            out hPrinter,
            IntPtr.Zero
        ))
        {
            return false;
        }

        DOCINFOA di = new DOCINFOA();

        di.pDocName = "Mesa Facil";
        di.pOutputFile = null;
        di.pDataType = "RAW";

        bool documentStarted = false;
        bool pageStarted = false;

        try
        {
            documentStarted =
                StartDocPrinter(
                    hPrinter,
                    1,
                    di
                );

            if (!documentStarted)
                return false;

            pageStarted =
                StartPagePrinter(hPrinter);

            if (!pageStarted)
                return false;

            int written;

            bool result =
                WritePrinter(
                    hPrinter,
                    data,
                    data.Length,
                    out written
                );

            return result &&
                   written == data.Length;
        }
        finally
        {
            if (pageStarted)
                EndPagePrinter(hPrinter);

            if (documentStarted)
                EndDocPrinter(hPrinter);

            ClosePrinter(hPrinter);
        }
    }
}
"@


# Evita erro caso a classe já tenha sido carregada
if (-not ("RawPrinter" -as [type])) {
    Add-Type $rawType
}


# ============================================================
# ENVIAR
# ============================================================

$result = [RawPrinter]::Send(
    $printerName,
    $data
)


if (!$result) {
    throw "Não foi possível enviar os dados RAW para '$printerName'."
}


Write-Output "RAW enviado com sucesso para $printerName [$printerPort]"