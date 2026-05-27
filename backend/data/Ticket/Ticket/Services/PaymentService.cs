using Microsoft.EntityFrameworkCore;
using Ticket.Data;
using Ticket.DTOs;
using Ticket.Models;

namespace Ticket.Services;

public class PaymentService : IPaymentService
{
    private const string CompletedStatus = "Completed";
    private const string ExpiredStatus = "Expired";
    private const string PendingStatus = "Pending";
    private const string ReservedStatus = "Reserved";
    private const string SoldStatus = "Sold";
    private const string AvailableStatus = "Available";

    private readonly AppDbContext _context;

    public PaymentService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PaymentResponseDto> CreatePaymentAsync(CreatePaymentRequest request)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        var transactionCompleted = false;
        var now = DateTime.UtcNow;

        try
        {
            var reservation = await _context.Reservations
                .Include(currentReservation => currentReservation.Seat)
                .FirstOrDefaultAsync(currentReservation => currentReservation.Id == request.ReservationId);

            if (reservation is null)
            {
                AddAuditLog(request.UserId, "PAYMENT_FAILED", request.ReservationId.ToString(), "Reservation not found", now);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                transactionCompleted = true;
                throw new InvalidOperationException("Reserva no encontrada");
            }

            if (reservation.UserId != request.UserId)
            {
                AddAuditLog(request.UserId, "PAYMENT_REJECTED", reservation.SeatId.ToString(), "Reservation belongs to another user", now);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                transactionCompleted = true;
                throw new InvalidOperationException("La reserva no pertenece al usuario");
            }

            if (reservation.Status != PendingStatus)
            {
                AddAuditLog(request.UserId, "PAYMENT_CONFLICT", reservation.SeatId.ToString(), $"Reservation status is {reservation.Status}", now);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                transactionCompleted = true;
                throw new ReservationConflictException("La reserva no esta pendiente de pago");
            }

            if (reservation.ExpiresAt <= now)
            {
                reservation.Status = ExpiredStatus;
                reservation.Seat.Status = AvailableStatus;
                reservation.Seat.Version++;

                AddAuditLog(request.UserId, "PAYMENT_EXPIRED", reservation.SeatId.ToString(), "Expired reservation released during payment", now);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                transactionCompleted = true;
                throw new ReservationConflictException("La reserva vencio");
            }

            if (reservation.Seat.Status != ReservedStatus)
            {
                AddAuditLog(request.UserId, "PAYMENT_CONFLICT", reservation.SeatId.ToString(), $"Seat status is {reservation.Seat.Status}", now);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                transactionCompleted = true;
                throw new ReservationConflictException("La butaca no esta reservada");
            }

            reservation.Status = CompletedStatus;
            reservation.ExpiresAt = now;
            reservation.Seat.Status = SoldStatus;
            reservation.Seat.Version++;

            _context.Purchases.Add(new Purchase
            {
                Id = Guid.NewGuid(),
                UserId = reservation.UserId,
                ReservationId = reservation.Id,
                SeatId = reservation.SeatId,
                PurchasedAt = now,
                Status = CompletedStatus,
                PaymentMethod = request.PaymentMethod
            });

            AddAuditLog(request.UserId, "PAYMENT_COMPLETED", reservation.SeatId.ToString(), "Reservation paid and seat sold", now);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            transactionCompleted = true;

            return new PaymentResponseDto
            {
                ReservationId = reservation.Id,
                SeatId = reservation.SeatId,
                SeatStatus = reservation.Seat.Status,
                ReservationStatus = reservation.Status,
                PaidAt = now
            };
        }
        catch
        {
            if (!transactionCompleted)
            {
                await transaction.RollbackAsync();
            }

            throw;
        }
    }

    public async Task<List<PaymentDto>> GetPaymentsAsync()
    {
        return await _context.Purchases
            .Include(p => p.User)
            .Include(p => p.Reservation)
                .ThenInclude(r => r.Seat)
                    .ThenInclude(s => s.Sector)
                        .ThenInclude(se => se.Event)
            .Select(p => new PaymentDto
            {
                User = p.User.Name,
                Event = p.Reservation.Seat.Sector.Event.Name,
                Amount = p.Reservation.Seat.Sector.Price,
                PaymentMethod = p.PaymentMethod,
                PaidAt = p.PurchasedAt
            })
            .ToListAsync();
    }

    private void AddAuditLog(
        int? userId,
        string action,
        string entityId,
        string details,
        DateTime createdAt)
    {
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = nameof(Reservation),
            EntityId = entityId,
            Details = details,
            CreatedAt = createdAt
        });
    }
}
