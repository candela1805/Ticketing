namespace Ticket.DTOs;

public class ReservationResponseDto
{
    public Guid ReservationId { get; set; }
    public Guid SeatId { get; set; }
    public string SeatStatus { get; set; } = string.Empty;
    public string ReservationStatus { get; set; } = string.Empty;
    public DateTime ReservedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
