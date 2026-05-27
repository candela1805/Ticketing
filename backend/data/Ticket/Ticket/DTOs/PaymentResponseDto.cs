namespace Ticket.DTOs;

public class PaymentResponseDto
{
    public Guid ReservationId { get; set; }
    public Guid SeatId { get; set; }
    public string SeatStatus { get; set; } = string.Empty;
    public string ReservationStatus { get; set; } = string.Empty;
    public DateTime PaidAt { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
}
