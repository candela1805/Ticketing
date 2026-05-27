using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ticket.Models;

public class Purchase
{
    [Key]
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public Guid ReservationId { get; set; }
    public Guid SeatId { get; set; }
    public DateTime PurchasedAt { get; set; }
    public string Status { get; set; } = "Completed";

    public string PaymentMethod { get; set; } = string.Empty;

    [ForeignKey("UserId")]
    public User User { get; set; } = null!;

    [ForeignKey("ReservationId")]
    public Reservation Reservation { get; set; } = null!;

    [ForeignKey("SeatId")]
    public Seat Seat { get; set; } = null!;
}
