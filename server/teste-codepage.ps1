param(
[string]$arquivo
)

$texto = @"
MESA FACIL

Acentos:

á é í ó ú
ã õ ç
AÇÃO
JOÃO
HAMBÚRGUER
PREFERÊNCIA

"@

$encodings = @(
    "utf8",
    "iso-8859-1",
    "windows-1252",
    "ibm850",
    "ibm858"
)


foreach($enc in $encodings){

    $nome = "$enc.raw"

    Write-Host "Gerando $nome"

    $bytes = [System.Text.Encoding]::GetEncoding($enc).GetBytes($texto)

    [System.IO.File]::WriteAllBytes(
        $nome,
        $bytes
    )

}