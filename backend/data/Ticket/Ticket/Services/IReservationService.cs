using Ticket.DTOs;

namespace Ticket.Services;

public interface IReservationService
{
    Task<ReservationResponseDto> CreateReservationAsync(CreateReservationRequest request);
}
