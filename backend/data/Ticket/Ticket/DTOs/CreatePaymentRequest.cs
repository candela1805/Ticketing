namespace Ticket.DTOs;

public class CreatePaymentRequest
{
    public int UserId { get; set; }
    public Guid ReservationId { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
}
