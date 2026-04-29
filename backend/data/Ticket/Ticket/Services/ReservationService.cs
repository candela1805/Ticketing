using Microsoft.EntityFrameworkCore;
using Ticket.Data;
using Ticket.DTOs;
using Ticket.Models;

namespace Ticket.Services;

public class ReservationService : IReservationService
{
    private const int ReservationExpirationMinutes = 5;
    private const string AvailableStatus = "Available";
    private const string PendingStatus = "Pending";
    private const string ReservedStatus = "Reserved";

    private readonly AppDbContext _context;

    public ReservationService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ReservationResponseDto> CreateReservationAsync(CreateReservationRequest request)
    {
        var seat = await _context.Seats.FirstOrDefaultAsync(seat => seat.Id == request.SeatId);

        if (seat is null)
        {
            throw new InvalidOperationException("Butaca no encontrada");
        }

        if (seat.Status != AvailableStatus)
        {
            throw new InvalidOperationException("Butaca no disponible");
        }

        var reservedAt = DateTime.UtcNow;
        seat.Status = ReservedStatus;
        seat.Version++;

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            SeatId = request.SeatId,
            Status = PendingStatus,
            ReservedAt = reservedAt,
            ExpiresAt = reservedAt.AddMinutes(ReservationExpirationMinutes)
        };

        var audit = new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Action = "RESERVE",
            EntityType = nameof(Seat),
            EntityId = seat.Id.ToString(),
            Details = "Seat reserved",
            CreatedAt = reservedAt
        };

        _context.Reservations.Add(reservation);
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return new ReservationResponseDto
        {
            ReservationId = reservation.Id,
            SeatId = reservation.SeatId,
            SeatStatus = seat.Status,
            ReservationStatus = reservation.Status,
            ReservedAt = reservation.ReservedAt,
            ExpiresAt = reservation.ExpiresAt
        };
    }
}
