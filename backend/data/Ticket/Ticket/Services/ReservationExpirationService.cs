using Microsoft.EntityFrameworkCore;
using Ticket.Data;
using Ticket.Models;

namespace Ticket.Services;

public class ReservationExpirationService : IReservationExpirationService
{
    private const string ExpiredStatus = "Expired";
    private const string PendingStatus = "Pending";
    private const string ReservedStatus = "Reserved";
    private const string AvailableStatus = "Available";

    private readonly AppDbContext _context;

    public ReservationExpirationService(AppDbContext context)
    {
        _context = context;
    }

    public async Task ReleaseExpiredReservationsAsync()
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        var now = DateTime.UtcNow;

        try
        {
            var expiredReservations = await _context.Reservations
                .Include(reservation => reservation.Seat)
                .Where(reservation =>
                    reservation.Status == PendingStatus &&
                    reservation.ExpiresAt <= now &&
                    reservation.Seat.Status == ReservedStatus)
                .ToListAsync();

            foreach (var reservation in expiredReservations)
            {
                reservation.Status = ExpiredStatus;
                reservation.Seat.Status = AvailableStatus;
                reservation.Seat.Version++;

                _context.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    UserId = reservation.UserId,
                    Action = "RESERVATION_EXPIRED",
                    EntityType = nameof(Seat),
                    EntityId = reservation.SeatId.ToString(),
                    Details = "Expired reservation released seat inventory",
                    CreatedAt = now
                });
            }

            if (expiredReservations.Count > 0)
            {
                await _context.SaveChangesAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
