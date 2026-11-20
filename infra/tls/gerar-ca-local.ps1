# Gera uma CA local e o certificado do captura7 para localhost e para o IP da rede.
# Requer openssl no PATH (o Git for Windows inclui). Não commite a pasta certs-local.
param(
  [string]$Ips = $env:CERT_IPS,
  [string]$Saida = "certs-local"
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
  Write-Error "Não achei o openssl no PATH. Instale o Git for Windows, que inclui o openssl, e abra um PowerShell novo. Se o script nem começar, rode Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass nesta janela."
}

New-Item -ItemType Directory -Force -Path $Saida | Out-Null
$caKey = Join-Path $Saida "ca.key"
$caCrt = Join-Path $Saida "ca.crt"
$chave = Join-Path $Saida "captura7.key"
$csr = Join-Path $Saida "captura7.csr"
$crt = Join-Path $Saida "captura7.crt"
$ext = Join-Path $Saida "captura7.ext"

if (-not (Test-Path $caKey) -or -not (Test-Path $caCrt)) {
  & openssl req -x509 -nodes -newkey rsa:2048 -days 825 `
    -keyout $caKey -out $caCrt -subj "/CN=captura7-ca-local"
}

$san = "DNS:localhost,IP:127.0.0.1"
if ($Ips) {
  foreach ($ip in ($Ips -split ",")) {
    $limpo = $ip.Trim()
    if ($limpo) { $san = "$san,IP:$limpo" }
  }
}

& openssl req -new -nodes -newkey rsa:2048 -keyout $chave -out $csr -subj "/CN=captura7"
@(
  "subjectAltName=$san"
  "extendedKeyUsage=serverAuth"
  "basicConstraints=CA:FALSE"
) | Set-Content -Path $ext -Encoding ascii
& openssl x509 -req -in $csr -CA $caCrt -CAkey $caKey -CAcreateserial -out $crt -days 825 -extfile $ext
Remove-Item $csr, $ext -ErrorAction SilentlyContinue
Write-Output "CA e certificado gravados em $Saida. Instale ca.crt no computador e no celular."
