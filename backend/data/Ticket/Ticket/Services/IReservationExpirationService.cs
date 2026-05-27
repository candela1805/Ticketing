namespace Ticket.Services;

public interface IReservationExpirationService
{
    Task ReleaseExpiredReservationsAsync();
}
