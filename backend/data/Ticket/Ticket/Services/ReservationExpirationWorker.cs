namespace Ticket.Services;

public class ReservationExpirationWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    private readonly ILogger<ReservationExpirationWorker> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    public ReservationExpirationWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<ReservationExpirationWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            await ReleaseExpiredReservationsAsync(stoppingToken);

            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task ReleaseExpiredReservationsAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var expirationService = scope.ServiceProvider.GetRequiredService<IReservationExpirationService>();
            await expirationService.ReleaseExpiredReservationsAsync();
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error releasing expired reservations.");
        }
    }
}
