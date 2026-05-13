param(
    [string]$ApiBase = "http://localhost:5065/api/v1",
    [Parameter(Mandatory = $true)]
    [string]$SeatId,
    [int]$UserId = 1,
    [int]$Requests = 20
)

$body = @{
    userId = $UserId
    seatId = $SeatId
} | ConvertTo-Json

$jobs = 1..$Requests | ForEach-Object {
    Start-Job -ArgumentList $ApiBase, $body -ScriptBlock {
        param($ApiBase, $body)

        try {
            $response = Invoke-WebRequest `
                -Uri "$ApiBase/reservations" `
                -Method Post `
                -ContentType "application/json" `
                -Body $body `
                -UseBasicParsing

            [pscustomobject]@{
                StatusCode = $response.StatusCode
                Body = $response.Content
            }
        }
        catch {
            $statusCode = 0
            $content = $_.Exception.Message

            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode

                try {
                    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                    $content = $reader.ReadToEnd()
                }
                catch {
                    $content = $_.Exception.Message
                }
            }

            [pscustomobject]@{
                StatusCode = $statusCode
                Body = $content
            }
        }
    }
}

$results = Receive-Job -Job $jobs -Wait
Remove-Job -Job $jobs

$results |
    Group-Object StatusCode |
    Sort-Object Name |
    Select-Object Name, Count

$successCount = ($results | Where-Object { $_.StatusCode -eq 200 -or $_.StatusCode -eq 201 }).Count
$conflictCount = ($results | Where-Object { $_.StatusCode -eq 409 }).Count

Write-Host "Success: $successCount"
Write-Host "Conflict: $conflictCount"

if ($successCount -ne 1 -or $conflictCount -ne ($Requests - 1)) {
    Write-Error "Expected 1 success and $($Requests - 1) conflicts."
    exit 1
}
