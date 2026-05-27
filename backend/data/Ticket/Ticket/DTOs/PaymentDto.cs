namespace Ticket.DTOs
{
    public class PaymentDto
    {
        public string User { get; set; } = string.Empty;
        public string Event { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public DateTime PaidAt { get; set; }
    }
}
